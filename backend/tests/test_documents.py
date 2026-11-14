from sqlmodel import Session

from app.models import Client, DocumentType, Policy
from app.services.document import DocumentService
from tests.utils.utils import random_email, random_lower_string


def test_polymorphic_documents(db: Session) -> None:
    # 1. Create entities
    client_obj = Client(
        name=random_lower_string(),
        kra_pin=random_lower_string(),
        email=random_email(),
        phone=random_lower_string(),
    )
    db.add(client_obj)
    db.commit()
    db.refresh(client_obj)
    client = client_obj

    policy_obj = Policy(
        policy_number=random_lower_string(),
        client_id=client.id,
    )
    db.add(policy_obj)
    db.commit()
    db.refresh(policy_obj)
    policy = policy_obj

    # 2. Create documents for different entities
    # We want specialized classes, but for now we'll use the existing model
    # and expect it to work. After refactor, we'll use specialized ones.
    from app.models import Document, DocumentEntityType

    doc1 = Document(
        entity_type=DocumentEntityType.CLIENT,
        entity_id=client.id,
        document_type=DocumentType.ID,
        file_path="path/to/id.jpg",
    )
    db.add(doc1)

    doc2 = Document(
        entity_type=DocumentEntityType.POLICY,
        entity_id=policy.id,
        document_type=DocumentType.LOGBOOK,
        file_path="path/to/logbook.pdf",
    )
    db.add(doc2)
    db.commit()

    # 3. Verify retrieval
    # Standard document list should return both
    docs, _ = DocumentService.list_documents(session=db)
    assert len(docs) >= 2

    # Filtering by entity should work
    client_docs, _ = DocumentService.list_documents(session=db, entity_id=client.id)
    assert len(client_docs) == 1
    assert client_docs[0].document_type == DocumentType.ID

    # 4. Verify referential integrity (This will only work after specialized tables)
    # If we delete a client, its documents should be deleted or blocked
    # With generic entity_id, there is no real FK constraint.


def test_document_service_lifecycle_and_filtering(db: Session) -> None:
    import uuid

    import pytest

    from app.models import DocumentCreate, DocumentEntityType, DocumentUpdate
    from app.services.document import DocumentNotFoundError, DocumentService

    entity_a = uuid.uuid4()
    entity_b = uuid.uuid4()

    doc_a = DocumentService.create_document(
        session=db,
        document_in=DocumentCreate(
            entity_type=DocumentEntityType.CLIENT,
            entity_id=entity_a,
            document_type=DocumentType.ID,
            file_path=f"client/{entity_a}/id.pdf",
            mime_type="application/pdf",
            doc_metadata={"source": "upload"},
        ),
    )
    doc_b = DocumentService.create_document(
        session=db,
        document_in=DocumentCreate(
            entity_type=DocumentEntityType.POLICY,
            entity_id=entity_b,
            document_type=DocumentType.LOGBOOK,
            file_path=f"policy/{entity_b}/logbook.pdf",
            mime_type="application/pdf",
        ),
    )

    fetched = DocumentService.get_document(session=db, document_id=doc_a.id)
    assert fetched is not None
    assert fetched.id == doc_a.id
    assert fetched.file_path == f"client/{entity_a}/id.pdf"

    docs_a, count_a = DocumentService.list_documents(
        session=db, entity_id=entity_a, entity_type=DocumentEntityType.CLIENT.value
    )
    assert count_a == 1
    assert [d.id for d in docs_a] == [doc_a.id]

    updated = DocumentService.update_document(
        session=db,
        document_id=doc_a.id,
        document_in=DocumentUpdate(mime_type="image/png"),
    )
    assert updated.mime_type == "image/png"

    deleted = DocumentService.delete_document(session=db, document_id=doc_b.id)
    assert deleted.id == doc_b.id
    assert DocumentService.get_document(session=db, document_id=doc_b.id) is None

    with pytest.raises(DocumentNotFoundError):
        DocumentService.delete_document(session=db, document_id=doc_b.id)


def test_document_job_service_reads_and_retry_guards(db: Session) -> None:
    import uuid

    import pytest

    from app.models import DocumentJobCreate, DocumentJobResourceType, DocumentJobStatus
    from app.services.document_job import (
        DocumentJobConflictError,
        DocumentJobNotFoundError,
        DocumentJobService,
    )

    job = DocumentJobService.create_job(
        session=db,
        job_in=DocumentJobCreate(
            resource_type=DocumentJobResourceType.STATEMENT,
            idempotency_key=f"test-job-{uuid.uuid4().hex}",
            snapshot_data={"client_name": "Test Client"},
        ),
    )

    fetched = DocumentJobService.get_job(session=db, job_id=job.id)
    assert fetched is not None
    assert fetched.id == job.id

    jobs, count = DocumentJobService.list_jobs(session=db, skip=0, limit=10)
    assert count >= 1
    assert any(j.id == job.id for j in jobs)

    job.status = DocumentJobStatus.SUCCEEDED
    db.add(job)
    db.commit()

    with pytest.raises(DocumentJobConflictError):
        DocumentJobService.retry_job(session=db, job_id=job.id)

    with pytest.raises(DocumentJobNotFoundError):
        DocumentJobService.retry_job(session=db, job_id=uuid.uuid4())


def test_store_document_validates_metadata_and_cleans_up_on_db_error(
    db: Session, tmp_path
) -> None:
    import io
    import uuid
    from unittest.mock import patch

    import pytest

    from app.core.storage import LocalFileSystemProvider
    from app.models import DocumentEntityType
    from app.services.document import DocumentService, DocumentValidationError

    provider = LocalFileSystemProvider(base_dir=str(tmp_path))
    entity_id = uuid.uuid4()

    # Happy path
    doc = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"hello pdf"),
        filename="id_card.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
        mime_type="application/pdf",
        metadata='{"source": "upload"}',
    )
    assert doc.id is not None
    assert doc.file_path.startswith("client/")
    assert doc.doc_metadata == {"source": "upload"}
    assert provider.get_file_path(doc.file_path).exists()

    # Invalid JSON raises DocumentValidationError
    with pytest.raises(DocumentValidationError):
        DocumentService.store_document(
            session=db,
            storage_provider=provider,
            file=io.BytesIO(b"bad"),
            filename="bad.pdf",
            entity_type=DocumentEntityType.CLIENT,
            entity_id=entity_id,
            document_type=DocumentType.ID,
            metadata="{not-json",
        )

    # Non-object JSON raises DocumentValidationError
    with pytest.raises(DocumentValidationError):
        DocumentService.store_document(
            session=db,
            storage_provider=provider,
            file=io.BytesIO(b"bad"),
            filename="bad.pdf",
            entity_type=DocumentEntityType.CLIENT,
            entity_id=entity_id,
            document_type=DocumentType.ID,
            metadata="[1, 2, 3]",
        )

    # DB persistence failure cleans up saved binary
    with patch.object(db, "commit", side_effect=RuntimeError("db down")):
        with pytest.raises(RuntimeError, match="db down"):
            DocumentService.store_document(
                session=db,
                storage_provider=provider,
                file=io.BytesIO(b"orphan"),
                filename="orphan.pdf",
                entity_type=DocumentEntityType.CLIENT,
                entity_id=entity_id,
                document_type=DocumentType.ID,
            )
    # Only the first happy-path file should remain in client/
    saved_files = list((tmp_path / "client").iterdir())
    assert len(saved_files) == 1


def test_resolve_download_filename_precedence_and_missing_errors(
    db: Session, tmp_path
) -> None:
    import io
    import uuid

    import pytest

    from app.core.storage import LocalFileSystemProvider
    from app.models import DocumentEntityType
    from app.services.document import (
        DocumentNotFoundError,
        DocumentService,
        ResolvedDocumentArtifact,
    )

    provider = LocalFileSystemProvider(base_dir=str(tmp_path))
    entity_id = uuid.uuid4()

    # 1. doc_metadata["filename"] takes precedence
    doc1 = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"pdf1"),
        filename="a.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
        mime_type="application/pdf",
        metadata={"filename": "custom.pdf", "original_filename": "orig.pdf"},
    )
    art1 = DocumentService.resolve_download(
        session=db, document_id=doc1.id, storage_provider=provider
    )
    assert isinstance(art1, ResolvedDocumentArtifact)
    assert art1.path == provider.get_file_path(doc1.file_path)
    assert art1.media_type == "application/pdf"
    assert art1.filename == "custom.pdf"

    # 2. Falls back to doc_metadata["original_filename"]
    doc2 = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"pdf2"),
        filename="b.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
        metadata={"original_filename": "orig.pdf"},
    )
    art2 = DocumentService.resolve_download(
        session=db, document_id=doc2.id, storage_provider=provider
    )
    assert art2.filename == "orig.pdf"

    # 3. Falls back to f"{document.document_type}_{document.id}{suffix}"
    doc3 = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"pdf3"),
        filename="c.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
    )
    art3 = DocumentService.resolve_download(
        session=db, document_id=doc3.id, storage_provider=provider
    )
    assert art3.filename == f"{doc3.document_type}_{doc3.id}.pdf"

    # 4. Missing record raises DocumentNotFoundError
    with pytest.raises(DocumentNotFoundError):
        DocumentService.resolve_download(
            session=db, document_id=uuid.uuid4(), storage_provider=provider
        )

    # 5. Missing physical file raises DocumentNotFoundError
    provider.delete_file(doc3.file_path)
    with pytest.raises(DocumentNotFoundError):
        DocumentService.resolve_download(
            session=db, document_id=doc3.id, storage_provider=provider
        )


def test_remove_document_enforces_adr0006_and_deletes_file_after_commit(
    db: Session, tmp_path
) -> None:
    import io
    import uuid
    from unittest.mock import patch

    import pytest

    from app.core.storage import LocalFileSystemProvider
    from app.models import DocumentEntityType
    from app.services.document import (
        DocumentConflictError,
        DocumentNotFoundError,
        DocumentService,
    )

    provider = LocalFileSystemProvider(base_dir=str(tmp_path))
    entity_id = uuid.uuid4()

    # 1. Document linked to a DocumentJob raises DocumentConflictError
    job_doc = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"job pdf"),
        filename="job.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
        metadata={"document_job_id": str(uuid.uuid4())},
    )
    with pytest.raises(DocumentConflictError):
        DocumentService.remove_document(
            session=db, document_id=job_doc.id, storage_provider=provider
        )
    assert provider.get_file_path(job_doc.file_path).exists()

    # 2. If session.commit() fails, physical file is NOT deleted
    normal_doc = DocumentService.store_document(
        session=db,
        storage_provider=provider,
        file=io.BytesIO(b"normal pdf"),
        filename="normal.pdf",
        entity_type=DocumentEntityType.CLIENT,
        entity_id=entity_id,
        document_type=DocumentType.ID,
    )
    with patch.object(db, "commit", side_effect=RuntimeError("commit failed")):
        with pytest.raises(RuntimeError, match="commit failed"):
            DocumentService.remove_document(
                session=db, document_id=normal_doc.id, storage_provider=provider
            )
    db.rollback()
    assert provider.get_file_path(normal_doc.file_path).exists()

    # 3. Normal removal deletes DB record and physical file
    deleted = DocumentService.remove_document(
        session=db, document_id=normal_doc.id, storage_provider=provider
    )
    assert deleted.id == normal_doc.id
    assert not provider.get_file_path(normal_doc.file_path).exists()
    assert DocumentService.get_document(session=db, document_id=normal_doc.id) is None

    # 4. Missing document raises DocumentNotFoundError
    with pytest.raises(DocumentNotFoundError):
        DocumentService.remove_document(
            session=db, document_id=uuid.uuid4(), storage_provider=provider
        )




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

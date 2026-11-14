import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO

from sqlmodel import Session, func, select

from app.core.storage import StorageProvider, storage
from app.models import Document, DocumentCreate, DocumentUpdate


class DocumentNotFoundError(LookupError):
    """Raised when a Document record or its physical artifact cannot be found."""


class DocumentValidationError(ValueError):
    """Raised when document input or metadata fails validation."""


class DocumentConflictError(ValueError):
    """Raised when a document operation conflicts with domain invariants (e.g. ADR-0006)."""


@dataclass(frozen=True)
class ResolvedDocumentArtifact:
    """Resolved physical artifact metadata for downloading a Document."""

    path: Path
    media_type: str | None
    filename: str


def _parse_metadata(metadata: dict[str, Any] | str | None) -> dict[str, Any]:
    if metadata is None or metadata == "":
        return {}
    if isinstance(metadata, str):
        try:
            parsed = json.loads(metadata)
        except json.JSONDecodeError as exc:
            raise DocumentValidationError("Invalid metadata JSON") from exc
    else:
        parsed = metadata
    if not isinstance(parsed, dict):
        raise DocumentValidationError("Document metadata must be a JSON object")
    return parsed


class DocumentService:
    """Owns Document persistence, queries, and mutations."""

    @staticmethod
    def store_document(
        *,
        session: Session,
        file: BinaryIO,
        filename: str,
        entity_type: str,
        entity_id: uuid.UUID,
        document_type: str,
        mime_type: str | None = None,
        metadata: dict[str, Any] | str | None = None,
        folder: str | None = None,
        storage_provider: StorageProvider = storage,
        commit: bool = True,
    ) -> Document:
        """Save binary to storage and persist Document metadata atomically."""
        parsed_metadata = _parse_metadata(metadata)
        target_folder = folder if folder is not None else entity_type.lower()
        relative_path = storage_provider.save_file(
            file,
            filename=filename or "unnamed_file",
            folder=target_folder,
        )

        document_in = DocumentCreate(
            entity_type=entity_type,
            entity_id=entity_id,
            document_type=document_type,
            file_path=relative_path,
            mime_type=mime_type,
            doc_metadata=parsed_metadata,
        )
        db_obj = Document.model_validate(document_in)
        try:
            session.add(db_obj)
            if commit:
                session.commit()
                session.refresh(db_obj)
            else:
                session.flush()
            return db_obj
        except Exception:
            storage_provider.delete_file(relative_path)
            raise

    @staticmethod
    def create_document(*, session: Session, document_in: DocumentCreate) -> Document:
        """Persist a new Document record atomically."""
        db_obj = Document.model_validate(document_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

    @staticmethod
    def resolve_download(
        *,
        session: Session,
        document_id: uuid.UUID,
        storage_provider: StorageProvider = storage,
    ) -> ResolvedDocumentArtifact:
        """Resolve a Document's physical file path, media type, and download filename."""
        document = session.get(Document, document_id)
        if not document:
            raise DocumentNotFoundError("Document not found")

        absolute_path = storage_provider.get_file_path(document.file_path)
        if not absolute_path.exists():
            raise DocumentNotFoundError(
                f"Physical file missing from storage: {document.file_path}"
            )

        meta = document.doc_metadata or {}
        suffix = Path(document.file_path).suffix
        filename = (
            meta.get("filename")
            or meta.get("original_filename")
            or f"{document.document_type}_{document.id}{suffix}"
        )
        return ResolvedDocumentArtifact(
            path=absolute_path,
            media_type=document.mime_type,
            filename=filename,
        )

    @staticmethod
    def get_document(*, session: Session, document_id: uuid.UUID) -> Document | None:
        """Fetch a Document by primary key."""
        return session.get(Document, document_id)

    @staticmethod
    def list_documents(
        *,
        session: Session,
        skip: int = 0,
        limit: int = 100,
        entity_id: uuid.UUID | None = None,
        entity_type: str | None = None,
    ) -> tuple[list[Document], int]:
        """Return paginated Documents matching optional entity filters and their total count."""
        statement = select(Document)
        if entity_id:
            statement = statement.where(Document.entity_id == entity_id)
        if entity_type:
            statement = statement.where(Document.entity_type == entity_type)

        count = session.exec(select(func.count()).select_from(statement.subquery())).one()
        items = list(session.exec(statement.offset(skip).limit(limit)).all())
        return items, count

    @staticmethod
    def update_document(
        *,
        session: Session,
        document_id: uuid.UUID,
        document_in: DocumentUpdate,
    ) -> Document:
        """Update an existing Document atomically."""
        db_document = session.get(Document, document_id)
        if not db_document:
            raise DocumentNotFoundError("Document not found")

        document_data = document_in.model_dump(exclude_unset=True)
        db_document.sqlmodel_update(document_data)
        session.add(db_document)
        session.commit()
        session.refresh(db_document)
        return db_document

    @staticmethod
    def delete_document(*, session: Session, document_id: uuid.UUID) -> Document:
        """Delete a Document by ID atomically and return the deleted instance."""
        db_document = session.get(Document, document_id)
        if not db_document:
            raise DocumentNotFoundError("Document not found")

        session.delete(db_document)
        session.commit()
        return db_document

    @staticmethod
    def remove_document(
        *,
        session: Session,
        document_id: uuid.UUID,
        storage_provider: StorageProvider = storage,
    ) -> Document:
        """Delete a Document record and its physical file, enforcing ADR-0006."""
        db_document = session.get(Document, document_id)
        if not db_document:
            raise DocumentNotFoundError("Document not found")

        meta = db_document.doc_metadata or {}
        if meta.get("document_job_id"):
            raise DocumentConflictError(
                "Cannot delete a document generated by a DocumentJob"
            )

        file_path = db_document.file_path
        session.delete(db_document)
        session.commit()
        storage_provider.delete_file(file_path)
        return db_document

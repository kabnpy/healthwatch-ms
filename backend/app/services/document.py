import uuid

from sqlmodel import Session, func, select

from app.models import Document, DocumentCreate, DocumentUpdate


class DocumentNotFoundError(LookupError):
    """Raised when a Document record cannot be found."""


class DocumentService:
    """Owns Document persistence, queries, and mutations."""

    @staticmethod
    def create_document(*, session: Session, document_in: DocumentCreate) -> Document:
        """Persist a new Document record atomically."""
        db_obj = Document.model_validate(document_in)
        session.add(db_obj)
        session.commit()
        session.refresh(db_obj)
        return db_obj

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

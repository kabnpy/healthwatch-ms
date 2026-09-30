import uuid

from sqlmodel import Session

from app import crud
from app.models import Document, DocumentCreate, DocumentEntityType, DocumentType


def create_random_document(
    db: Session,
    entity_id: uuid.UUID | None = None,
    entity_type: DocumentEntityType = DocumentEntityType.CLIENT,
) -> Document:
    if not entity_id:
        from tests.utils.client import create_random_client

        client = create_random_client(db)
        entity_id = client.id

    document_in = DocumentCreate(
        entity_type=entity_type,
        entity_id=entity_id,
        document_type=DocumentType.OTHER,
        file_path=f"test/file_{uuid.uuid4()}.pdf",
        mime_type="application/pdf",
        doc_metadata={"test": True},
    )
    return crud.create_document(session=db, document_in=document_in)

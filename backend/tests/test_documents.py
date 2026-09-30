from sqlmodel import Session

from app import crud
from app.models import ClientCreate, DocumentType, PolicyCreate
from tests.utils.utils import random_email, random_lower_string


def test_polymorphic_documents(db: Session) -> None:
    # 1. Create entities
    client_in = ClientCreate(
        name=random_lower_string(),
        kra_pin=random_lower_string(),
        email=random_email(),
        phone=random_lower_string(),
    )
    client = crud.create_client(session=db, client_in=client_in)

    policy_in = PolicyCreate(
        policy_number=random_lower_string(),
        client_id=client.id,
    )
    policy = crud.create_policy(session=db, policy_in=policy_in)

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
    docs = crud.get_documents(session=db)
    assert len(docs) >= 2

    # Filtering by entity should work
    client_docs = crud.get_documents(session=db, entity_id=client.id)
    assert len(client_docs) == 1
    assert client_docs[0].document_type == DocumentType.ID

    # 4. Verify referential integrity (This will only work after specialized tables)
    # If we delete a client, its documents should be deleted or blocked
    # With generic entity_id, there is no real FK constraint.

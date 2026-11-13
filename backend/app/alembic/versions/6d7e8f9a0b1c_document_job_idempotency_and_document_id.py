"""Add document_id FK and unique idempotency_key constraint to DocumentJob

Revision ID: 6d7e8f9a0b1c
Revises: 5c6d7e8f9a0b
Create Date: 2026-11-13 19:20:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "6d7e8f9a0b1c"
down_revision = "5c6d7e8f9a0b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documentjob",
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        op.f("ix_documentjob_document_id"),
        "documentjob",
        ["document_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_documentjob_document_id_document",
        "documentjob",
        "document",
        ["document_id"],
        ["id"],
    )
    op.drop_index(op.f("ix_documentjob_idempotency_key"), table_name="documentjob")
    op.create_index(
        op.f("ix_documentjob_idempotency_key"),
        "documentjob",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_documentjob_idempotency_key"), table_name="documentjob")
    op.create_index(
        op.f("ix_documentjob_idempotency_key"),
        "documentjob",
        ["idempotency_key"],
        unique=False,
    )
    op.drop_constraint(
        "fk_documentjob_document_id_document",
        "documentjob",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_documentjob_document_id"), table_name="documentjob")
    op.drop_column("documentjob", "document_id")

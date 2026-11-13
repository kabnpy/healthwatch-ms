"""Drop obsolete receiptallocation, receipt, and correspondence tables

Revision ID: 7e8f9a0b1c2d
Revises: 6d7e8f9a0b1c
Create Date: 2026-11-13 21:21:30.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "7e8f9a0b1c2d"
down_revision = "6d7e8f9a0b1c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f("ix_receiptallocation_risk_note_id"), table_name="receiptallocation")
    op.drop_index(op.f("ix_receiptallocation_receipt_id"), table_name="receiptallocation")
    op.drop_index(op.f("ix_receiptallocation_invoice_id"), table_name="receiptallocation")
    op.drop_table("receiptallocation")

    op.drop_index(op.f("ix_receipt_receipt_number"), table_name="receipt")
    op.drop_index(op.f("ix_receipt_deleted_by_id"), table_name="receipt")
    op.drop_index(op.f("ix_receipt_deleted_at"), table_name="receipt")
    op.drop_index(op.f("ix_receipt_created_by_id"), table_name="receipt")
    op.drop_index(op.f("ix_receipt_client_id"), table_name="receipt")
    op.drop_table("receipt")
    sa.Enum(name="receiptstatus").drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f("ix_correspondence_deleted_by_id"), table_name="correspondence")
    op.drop_index(op.f("ix_correspondence_deleted_at"), table_name="correspondence")
    op.drop_index(op.f("ix_correspondence_client_id"), table_name="correspondence")
    op.drop_table("correspondence")


def downgrade() -> None:
    raise NotImplementedError(
        "Irreversible migration: dropped retired receiptallocation, receipt, and correspondence tables."
    )

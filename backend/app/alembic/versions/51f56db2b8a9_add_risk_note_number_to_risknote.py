"""add risk_note_number to risknote

Revision ID: 51f56db2b8a9
Revises: 1a377ea2e2f3
Create Date: 2026-02-09 14:04:15.576783

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '51f56db2b8a9'
down_revision = '1a377ea2e2f3'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add the column as nullable first
    op.add_column('risknote', sa.Column('risk_note_number', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

    # 2. Populate existing rows with unique identifiers
    # We use a simple concatenation of ID to ensure uniqueness for existing data
    op.execute("UPDATE risknote SET risk_note_number = 'RSK-' || substr(id::text, 1, 8)")

    # 3. Make it non-nullable and unique
    op.alter_column('risknote', 'risk_note_number', nullable=False)
    op.create_index(op.f('ix_risknote_risk_note_number'), 'risknote', ['risk_note_number'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_risknote_risk_note_number'), table_name='risknote')
    op.drop_column('risknote', 'risk_note_number')

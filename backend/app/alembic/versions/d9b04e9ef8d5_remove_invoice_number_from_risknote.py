"""Remove invoice_number from risknote

Revision ID: d9b04e9ef8d5
Revises: 22c76716029b
Create Date: 2026-02-26 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9b04e9ef8d5'
down_revision = '22c76716029b'
branch_labels = None
depends_on = None


def upgrade():
    # Remove invoice_number from risknote if it exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('risknote')]
    if 'invoice_number' in columns:
        op.drop_column('risknote', 'invoice_number')


def downgrade():
    # Add invoice_number back to risknote
    op.add_column('risknote', sa.Column('invoice_number', sa.VARCHAR(), autoincrement=False, nullable=True))

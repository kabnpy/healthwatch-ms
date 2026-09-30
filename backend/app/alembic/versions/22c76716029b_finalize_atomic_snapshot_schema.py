"""Finalize Atomic Snapshot schema

Revision ID: 22c76716029b
Revises: c5c580ca4b1f
Create Date: 2026-02-25 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '22c76716029b'
down_revision = 'c5c580ca4b1f'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Check if 'risk_details' exists in 'policy' and drop it if it does
    # (Cleaning up potential debris from previous failed migrations/states)
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Check 'policy' table columns
    policy_columns = [c['name'] for c in inspector.get_columns('policy')]
    if 'risk_details' in policy_columns:
        op.drop_column('policy', 'risk_details')

    # 2. Check 'risknote' table columns
    risknote_columns = [c['name'] for c in inspector.get_columns('risknote')]

    # Add 'cover_snapshot' if it doesn't exist
    if 'cover_snapshot' not in risknote_columns:
        op.add_column('risknote', sa.Column('cover_snapshot', sa.JSON(), nullable=True))
        op.execute("UPDATE risknote SET cover_snapshot = '{}'::jsonb WHERE cover_snapshot IS NULL")

    # Drop 'policy_snapshot' if it still exists
    if 'policy_snapshot' in risknote_columns:
        op.drop_column('risknote', 'policy_snapshot')

    # Drop 'payment_status' if it still exists (derived from invoice now)
    if 'payment_status' in risknote_columns:
        op.drop_column('risknote', 'payment_status')


def downgrade():
    # 1. Add 'risk_details' back to 'policy'
    op.add_column('policy', sa.Column('risk_details', sa.JSON(), nullable=True))

    # 2. Add 'policy_snapshot' and 'payment_status' back to 'risknote'
    op.add_column('risknote', sa.Column('policy_snapshot', sa.JSON(), nullable=True))
    op.add_column('risknote', sa.Column('payment_status', sa.VARCHAR(), nullable=True))

    # 3. Drop 'cover_snapshot'
    op.drop_column('risknote', 'cover_snapshot')

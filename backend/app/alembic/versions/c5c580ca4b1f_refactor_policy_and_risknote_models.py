"""Refactor Policy and RiskNote models

Revision ID: c5c580ca4b1f
Revises: 38cad97ed24a
Create Date: 2026-02-23 12:11:28.109039

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = 'c5c580ca4b1f'
down_revision = '38cad97ed24a'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add cover_snapshot to risknote
    op.add_column('risknote', sa.Column('cover_snapshot', sa.JSON(), nullable=True))
    
    # 2. Data migration: Copy data from policy_snapshot to cover_snapshot
    # The old structure was: policy_snapshot = {"risk_details": {...}, "terms": {...}}
    # The new structure is: cover_snapshot = {...} (the actual risk details)
    op.execute("""
        UPDATE risknote 
        SET cover_snapshot = policy_snapshot->'risk_details' 
        WHERE policy_snapshot IS NOT NULL AND (policy_snapshot->'risk_details') IS NOT NULL
    """)
    op.execute("UPDATE risknote SET cover_snapshot = '{}'::jsonb WHERE cover_snapshot IS NULL")
    
    # 3. Add inception_date to policy and populate it
    op.add_column('policy', sa.Column('inception_date', sa.Date(), nullable=True))
    op.execute("UPDATE policy SET inception_date = COALESCE(created_at::date, CURRENT_DATE) WHERE inception_date IS NULL")
    op.alter_column('policy', 'inception_date',
               existing_type=sa.DATE(),
               nullable=False)

    # 4. Remove redundant columns from risknote
    op.drop_column('risknote', 'policy_snapshot')
    op.drop_column('risknote', 'payment_status')


def downgrade():
    # 1. Add columns back to risknote
    op.add_column('risknote', sa.Column('payment_status', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('risknote', sa.Column('policy_snapshot', sa.JSON(), autoincrement=False, nullable=True))
    
    # 2. Data migration back: Restore policy_snapshot from cover_snapshot
    op.execute("""
        UPDATE risknote 
        SET policy_snapshot = json_build_object('risk_details', cover_snapshot)
        WHERE cover_snapshot IS NOT NULL
    """)
    op.execute("UPDATE risknote SET policy_snapshot = '{}'::jsonb WHERE policy_snapshot IS NULL")
    
    # 3. Drop inception_date from policy
    op.drop_column('policy', 'inception_date')
    
    # 4. Drop cover_snapshot from risknote
    op.drop_column('risknote', 'cover_snapshot')

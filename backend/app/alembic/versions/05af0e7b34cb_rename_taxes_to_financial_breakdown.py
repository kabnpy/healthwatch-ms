"""rename_taxes_to_financial_breakdown

Revision ID: 05af0e7b34cb
Revises: 1a295faf7423
Create Date: 2026-02-18 11:56:08.618043

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql
import json

# revision identifiers, used by Alembic.
revision = '05af0e7b34cb'
down_revision = '1a295faf7423'
branch_labels = None
depends_on = None


def upgrade():
    # Check if 'taxes' column exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('risknote')]

    # 1. Rename the column if it exists
    if 'taxes' in columns:
        op.alter_column('risknote', 'taxes', new_column_name='financial_breakdown')

    # 2. Transform existing data to new structure
    # Old structure: {"training_levy": 10.0, ...}
    # New structure: {"type": "base", "taxes": {"training_levy": 10.0, ...}, "net_premium": ..., "total_amount": ..., "commission_amount": ...}

    # We'll do a best-effort migration for existing records
    op.execute(
        """
        UPDATE risknote
        SET financial_breakdown = json_build_object(
            'type', 'base',
            'taxes', financial_breakdown,
            'net_premium', COALESCE(net_premium, 0),
            'total_amount', COALESCE(total_amount, 0),
            'commission_amount', COALESCE(commission_amount, 0)
        )
        WHERE financial_breakdown IS NOT NULL AND (financial_breakdown->>'type') IS NULL
        """
    )


def downgrade():
    # Check if 'financial_breakdown' column exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('risknote')]

    # 1. Revert structure (extract taxes field)
    op.execute(
        """
        UPDATE risknote
        SET financial_breakdown = financial_breakdown->'taxes'
        WHERE financial_breakdown IS NOT NULL AND (financial_breakdown->>'type') IS NOT NULL
        """
    )

    # 2. Rename back if it exists
    if 'financial_breakdown' in columns:
        op.alter_column('risknote', 'financial_breakdown', new_column_name='taxes')

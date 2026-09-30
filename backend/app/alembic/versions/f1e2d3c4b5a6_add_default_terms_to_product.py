"""Add default terms to product

Revision ID: f1e2d3c4b5a6
Revises: d9b04e9ef8d5
Create Date: 2026-02-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1e2d3c4b5a6'
down_revision = 'd9b04e9ef8d5'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    product_columns = [c['name'] for c in inspector.get_columns('product')]

    if 'default_benefits_and_limits' not in product_columns:
        op.add_column('product', sa.Column('default_benefits_and_limits', sa.String(), nullable=True))
    if 'default_excesses' not in product_columns:
        op.add_column('product', sa.Column('default_excesses', sa.String(), nullable=True))
    if 'default_special_clauses' not in product_columns:
        op.add_column('product', sa.Column('default_special_clauses', sa.String(), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    product_columns = [c['name'] for c in inspector.get_columns('product')]

    if 'default_benefits_and_limits' in product_columns:
        op.drop_column('product', 'default_benefits_and_limits')
    if 'default_excesses' in product_columns:
        op.drop_column('product', 'default_excesses')
    if 'default_special_clauses' in product_columns:
        op.drop_column('product', 'default_special_clauses')

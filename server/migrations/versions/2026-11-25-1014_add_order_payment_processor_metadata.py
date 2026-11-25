"""add order payment processor metadata

Revision ID: 4627a88d3c5e
Revises: 15b2a7c0d683
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "4627a88d3c5e"
down_revision = "15b2a7c0d683"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("orders", sa.Column("payment_processor_metadata", postgresql.JSONB()))


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("orders", "payment_processor_metadata")

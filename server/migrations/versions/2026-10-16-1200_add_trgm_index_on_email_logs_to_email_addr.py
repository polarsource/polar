"""add trgm index on email_logs to_email_addr

Revision ID: 7c1e4a9b2d3f
Revises: 836d98c9c876
Create Date: 2026-10-16 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c1e4a9b2d3f"
down_revision = "836d98c9c876"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_email_logs_to_email_addr_trgm"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    with op.get_context().autocommit_block():
        # Drop an INVALID index left by an interrupted concurrent build.
        op.drop_index(
            INDEX_NAME,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX_NAME,
            "email_logs",
            [sa.text("to_email_addr gin_trgm_ops")],
            postgresql_concurrently=True,
            postgresql_using="gin",
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX_NAME,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )

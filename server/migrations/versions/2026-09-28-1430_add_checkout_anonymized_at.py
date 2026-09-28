"""add checkouts.anonymized_at and its anonymization candidate index

Revision ID: 7c3e5f81b204
Revises: 1a1d29060b39
Create Date: 2026-09-28 14:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c3e5f81b204"
down_revision = "1a1d29060b39"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_checkouts_created_at_pending_anonymization"


def upgrade() -> None:
    # `IF NOT EXISTS`: entering the autocommit block below commits this column,
    # so an interrupted index build leaves it behind for the next attempt.
    op.execute(
        "ALTER TABLE checkouts "
        "ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMP WITH TIME ZONE"
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Recover an invalid index left by an interrupted concurrent build.
            op.drop_index(
                INDEX_NAME,
                table_name="checkouts",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "checkouts",
                ["created_at"],
                unique=False,
                postgresql_where=sa.text(
                    "anonymized_at IS NULL AND status = 'expired'"
                ),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="checkouts",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    op.drop_column("checkouts", "anonymized_at")

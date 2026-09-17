"""add pending webhook health index

Revision ID: fea5ce44fb88
Revises: 1b299ae956f3
Create Date: 2026-09-11 15:43:39.011912

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "fea5ce44fb88"
down_revision = "1b299ae956f3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_webhook_events_created_at_pending"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # A failed concurrent build can leave an invalid index behind.
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                INDEX_NAME,
                "webhook_events",
                ["created_at"],
                postgresql_include=["id"],
                postgresql_where=(
                    "succeeded IS NULL AND deleted_at IS NULL "
                    "AND payload IS NOT NULL AND NOT skipped"
                ),
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="webhook_events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")

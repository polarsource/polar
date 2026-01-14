"""Add index for undelivered webhooks

Revision ID: 7a1b2c3d4e5f
Revises: 5ec10e43a3b3
Create Date: 2026-01-14

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7a1b2c3d4e5f"
down_revision = "5ec10e43a3b3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_webhook_events_undelivered",
        "webhook_events",
        ["created_at"],
        unique=False,
        postgresql_where="succeeded IS NULL AND payload IS NOT NULL AND skipped IS FALSE",
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_events_undelivered", table_name="webhook_events")

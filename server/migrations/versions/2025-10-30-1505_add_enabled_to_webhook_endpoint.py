"""add_enabled_to_webhook_endpoint

Revision ID: 2c7d8141f6b4
Revises: 6632c7d5663e
Create Date: 2025-10-30 15:05:47.786461

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2c7d8141f6b4"
down_revision = "6632c7d5663e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "webhook_endpoints",
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("webhook_endpoints", "enabled")

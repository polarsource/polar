"""Add WebhookEndpoint.name

Revision ID: 8a3f5b2c1d9e
Revises: 908c6d81bb3f
Create Date: 2026-02-25 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8a3f5b2c1d9e"
down_revision = "908c6d81bb3f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("webhook_endpoints", sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("webhook_endpoints", "name")

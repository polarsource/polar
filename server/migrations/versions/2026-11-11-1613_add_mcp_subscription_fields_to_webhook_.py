"""add mcp subscription fields to webhook endpoints

Revision ID: f09f2f11e21c
Revises: 367fe9fac05f
Create Date: 2026-11-11 16:13:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f09f2f11e21c"
down_revision = "367fe9fac05f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "webhook_endpoints",
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("webhook_endpoints", "expires_at")

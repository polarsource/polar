"""Disable localhost webhook endpoints

Revision ID: 147643549822
Revises: 9b73bce01fd4
Create Date: 2026-03-14 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "147643549822"
down_revision = "9b73bce01fd4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE webhook_endpoints
            SET enabled = false
            WHERE enabled = true
              AND (
                url ~ '^https?://localhost([:/]|$)'
                OR url ~ '^https?://127\\.0\\.0\\.1([:/]|$)'
                OR url ~ '^https?://\\[::1\\]([:/]|$)'
                OR url ~ '^https?://0\\.0\\.0\\.0([:/]|$)'
              )
            """
        )
    )


def downgrade() -> None:
    pass

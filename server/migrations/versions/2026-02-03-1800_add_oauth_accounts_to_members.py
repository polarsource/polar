"""Add oauth_accounts to members

Revision ID: a3b7c9d1e2f4
Revises: 91e2e5df6a7f
Create Date: 2026-02-03 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a3b7c9d1e2f4"
down_revision = "91e2e5df6a7f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "oauth_accounts",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("members", "oauth_accounts")

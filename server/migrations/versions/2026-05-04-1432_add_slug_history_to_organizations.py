"""add slug_history to organizations

Revision ID: 199179085ab4
Revises: 8847acc26477
Create Date: 2026-05-04 14:32:41.589638

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "199179085ab4"
down_revision = "8847acc26477"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "slug_history",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "slug_history")

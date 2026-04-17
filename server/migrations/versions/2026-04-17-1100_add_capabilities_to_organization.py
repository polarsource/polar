"""Add capabilities JSONB to Organization

Revision ID: 346767c5c3fd
Revises: a1b2c3d4e5f2
Create Date: 2026-04-17 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "346767c5c3fd"
down_revision = "a1b2c3d4e5f2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "capabilities", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "capabilities")

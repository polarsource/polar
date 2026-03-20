"""Add risks JSONB column to organizations

Revision ID: a1b2c3d4e5f6
Revises: 006a22ac6a34
Create Date: 2026-03-20 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "006a22ac6a34"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("risks", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organizations", "risks")

"""Add legal_entity column to organizations

Revision ID: 42a73fdddb59
Revises: f43048f9cd3a
Create Date: 2026-03-16 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "42a73fdddb59"
down_revision = "f43048f9cd3a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("legal_entity", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "legal_entity")

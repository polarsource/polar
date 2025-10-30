"""Add organization internal_notes

Revision ID: c1u8i3khu6t3
Revises: 8a77908046f4
Create Date: 2025-10-30 10:47:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c1u8i3khu6t3"
down_revision = "8a77908046f4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("internal_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "internal_notes")

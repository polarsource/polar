"""add benefit visibility

Revision ID: c471909b640d
Revises: 2326c1c6236b
Create Date: 2026-06-10 10:24:08.541092

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c471909b640d"
down_revision = "2326c1c6236b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "benefits",
        sa.Column("visibility", sa.VARCHAR(), nullable=True, server_default="public"),
    )


def downgrade() -> None:
    op.drop_column("benefits", "visibility")

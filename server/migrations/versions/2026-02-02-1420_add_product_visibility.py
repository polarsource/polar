"""add product visibility

Revision ID: 64f3c8195104
Revises: a4e8f4ed3fa3
Create Date: 2026-02-02 14:20:40.397484

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "64f3c8195104"
down_revision = "a4e8f4ed3fa3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("visibility", sa.VARCHAR(), nullable=True, server_default="public"),
    )


def downgrade() -> None:
    op.drop_column("products", "visibility")

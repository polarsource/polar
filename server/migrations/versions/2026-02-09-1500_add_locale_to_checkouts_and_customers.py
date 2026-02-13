"""Add locale to checkouts and customers

Revision ID: 2026_02_09_1500
Revises: 6df4681e7cc7
Create Date: 2026-02-09 15:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2026_02_09_1500"
down_revision = "6df4681e7cc7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "checkouts",
        sa.Column("locale", sa.String(5), nullable=True),
    )
    op.add_column(
        "customers",
        sa.Column("locale", sa.String(5), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customers", "locale")
    op.drop_column("checkouts", "locale")

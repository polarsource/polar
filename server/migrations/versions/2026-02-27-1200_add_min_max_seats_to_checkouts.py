"""Add min_seats and max_seats to checkouts

Revision ID: 1f3638dfb58f
Revises: a7b3c9d2e1f0
Create Date: 2026-02-27 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1f3638dfb58f"
down_revision = "a7b3c9d2e1f0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("checkouts", sa.Column("min_seats", sa.Integer(), nullable=True))
    op.add_column("checkouts", sa.Column("max_seats", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("checkouts", "max_seats")
    op.drop_column("checkouts", "min_seats")

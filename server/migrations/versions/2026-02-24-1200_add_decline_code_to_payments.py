"""Add decline_code to payments

Revision ID: 5a3c7e9d1b2f
Revises: 138febbc19df
Create Date: 2026-02-24 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5a3c7e9d1b2f"
down_revision = "138febbc19df"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("decline_code", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "decline_code")

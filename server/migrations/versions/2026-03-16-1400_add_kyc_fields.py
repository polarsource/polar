"""Add KYC fields to users and organizations

Revision ID: a3c8e1f6b9d2
Revises: 37f2c8f7b4e1
Create Date: 2026-03-16 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar custom imports

# revision identifiers, used by Alembic.
revision = "a3c8e1f6b9d2"
down_revision = "37f2c8f7b4e1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Users
    op.add_column("users", sa.Column("first_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(2), nullable=True))
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))

    # Organizations
    op.add_column("organizations", sa.Column("country", sa.String(2), nullable=True))


def downgrade() -> None:
    op.drop_column("organizations", "country")
    op.drop_column("users", "date_of_birth")
    op.drop_column("users", "country")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")

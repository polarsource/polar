"""add_email_to_customer_seats

Revision ID: 8a7b9c0d1e2f
Revises: daafaba9088a
Create Date: 2026-01-08 09:20:32.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8a7b9c0d1e2f"
down_revision = "daafaba9088a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "customer_seats", sa.Column("email", sa.String(length=320), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("customer_seats", "email")

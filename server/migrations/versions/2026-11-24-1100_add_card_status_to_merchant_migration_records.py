"""add card status to merchant migration records

Revision ID: 7d2e94b1c6a8
Revises: 3c1e7a9d52f4
Create Date: 2026-11-24 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7d2e94b1c6a8"
down_revision = "3c1e7a9d52f4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.add_column(
        "merchant_migration_records",
        sa.Column("card_status", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.drop_column("merchant_migration_records", "card_status")

"""add payment_method to checkouts

Revision ID: a1c2f95b7d31
Revises: 55a5e94aaf9d
Create Date: 2026-07-21 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1c2f95b7d31"
down_revision = "55a5e94aaf9d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column("checkouts", sa.Column("payment_method", sa.String(), nullable=True))


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column("checkouts", "payment_method")

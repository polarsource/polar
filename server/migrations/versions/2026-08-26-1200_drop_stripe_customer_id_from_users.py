"""drop stripe_customer_id from users

Revision ID: b9d4e2f71c85
Revises: a83cf131398d
Create Date: 2026-08-26 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b9d4e2f71c85"
down_revision = "a83cf131398d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint("users_stripe_customer_id_key", "users", type_="unique")
    op.drop_column("users", "stripe_customer_id")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "users",
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
    )
    op.create_unique_constraint(
        "users_stripe_customer_id_key", "users", ["stripe_customer_id"]
    )

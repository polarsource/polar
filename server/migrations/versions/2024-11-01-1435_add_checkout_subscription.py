"""Add Checkout.subscription

Revision ID: d7c8189db05f
Revises: 2662afe0a807
Create Date: 2024-11-01 14:35:01.142160

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d7c8189db05f"
down_revision = "2662afe0a807"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("checkouts", sa.Column("subscription_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("checkouts_subscription_id_fkey"),
        "checkouts",
        "subscriptions",
        ["subscription_id"],
        ["id"],
        ondelete="set null",
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("checkouts_subscription_id_fkey"), "checkouts", type_="foreignkey"
    )
    op.drop_column("checkouts", "subscription_id")
    # ### end Alembic commands ###

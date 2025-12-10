"""add_member_id_to_customer_seats

Revision ID: cf31af43f14a
Revises: 44c10a1f55db
Create Date: 2025-12-10 14:42:08.397016

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cf31af43f14a"
down_revision = "44c10a1f55db"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("customer_seats", sa.Column("member_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_customer_seats_member_id"),
        "customer_seats",
        ["member_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("customer_seats_member_id_fkey"),
        "customer_seats",
        "members",
        ["member_id"],
        ["id"],
        ondelete="set null",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("customer_seats_member_id_fkey"), "customer_seats", type_="foreignkey"
    )
    op.drop_index(op.f("ix_customer_seats_member_id"), table_name="customer_seats")
    op.drop_column("customer_seats", "member_id")

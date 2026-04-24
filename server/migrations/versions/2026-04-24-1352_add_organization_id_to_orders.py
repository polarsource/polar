"""add organization_id to orders

Revision ID: ead15547bea8
Revises: d3f5e1a7b2c4
Create Date: 2026-04-24 13:52:42.737258

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ead15547bea8"
down_revision = "d3f5e1a7b2c4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("orders_organization_id_fkey"),
        "orders",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="restrict",
    )
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_orders_organization_id"),
            "orders",
            ["organization_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_constraint(
        op.f("orders_organization_id_fkey"), "orders", type_="foreignkey"
    )
    op.drop_index(op.f("ix_orders_organization_id"), table_name="orders")
    op.drop_column("orders", "organization_id")

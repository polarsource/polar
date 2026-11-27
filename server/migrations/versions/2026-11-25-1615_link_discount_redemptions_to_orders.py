"""Link discount redemptions to orders

Revision ID: dfe1a3d3e11f
Revises: b4d91a6f24c8
Create Date: 2026-11-25 16:15:02.104032

"""

import sqlalchemy as sa
from alembic import op

revision = "dfe1a3d3e11f"
down_revision = "b4d91a6f24c8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

TABLE = "discount_redemptions"
ORDER_INDEX = "ix_discount_redemptions_order_id"
ORDER_FK = "discount_redemptions_order_id_fkey"


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        TABLE,
        sa.Column("order_id", sa.Uuid(), nullable=True),
        if_not_exists=True,
    )
    op.drop_constraint(ORDER_FK, TABLE, type_="foreignkey", if_exists=True)
    op.create_foreign_key(
        ORDER_FK,
        TABLE,
        "orders",
        ["order_id"],
        ["id"],
        ondelete="cascade",
        postgresql_not_valid=True,
    )
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                ORDER_INDEX,
                table_name=TABLE,
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                ORDER_INDEX,
                TABLE,
                ["order_id"],
                unique=True,
                postgresql_where=sa.text("order_id IS NOT NULL"),
                postgresql_concurrently=True,
            )
            op.execute("SET lock_timeout = '5s'")
            op.execute(f"ALTER TABLE {TABLE} VALIDATE CONSTRAINT {ORDER_FK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_column(TABLE, "order_id")

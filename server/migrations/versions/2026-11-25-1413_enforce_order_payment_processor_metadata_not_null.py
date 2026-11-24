"""enforce order payment processor metadata not null

Revision ID: b4d91a6f24c8
Revises: e26a0596e9d3
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b4d91a6f24c8"
down_revision = "e26a0596e9d3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

NOT_NULL_CHECK = "orders_payment_processor_metadata_not_null_check"


def upgrade() -> None:
    context = op.get_context()
    with context.autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                "UPDATE orders SET payment_processor_metadata = '{}'::jsonb "
                "WHERE payment_processor_metadata IS NULL"
            )
            if context.as_sql or not op.get_bind().scalar(
                sa.text(
                    "SELECT EXISTS (SELECT 1 FROM pg_constraint "
                    "WHERE conrelid = 'orders'::regclass AND conname = :name)"
                ),
                {"name": NOT_NULL_CHECK},
            ):
                op.execute(
                    f"ALTER TABLE orders ADD CONSTRAINT {NOT_NULL_CHECK} "
                    "CHECK (payment_processor_metadata IS NOT NULL) NOT VALID"
                )
            op.execute(f"ALTER TABLE orders VALIDATE CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "orders",
        "payment_processor_metadata",
        existing_type=postgresql.JSONB(),
        nullable=False,
    )
    op.drop_constraint(op.f(NOT_NULL_CHECK), "orders", type_="check")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "orders",
        "payment_processor_metadata",
        existing_type=postgresql.JSONB(),
        nullable=True,
    )

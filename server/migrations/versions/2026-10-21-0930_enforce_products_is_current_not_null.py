"""enforce products.is_current NOT NULL

Revision ID: 9c7e4a1f2b38
Revises: 4f8a2c6e1b90
Create Date: 2026-10-21 09:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9c7e4a1f2b38"
down_revision = "4f8a2c6e1b90"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "products_is_current_not_null_check"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute("UPDATE products SET is_current = true WHERE is_current IS NULL")

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        "WHERE conname = :name AND conrelid = 'products'::regclass"
                    ),
                    {"name": NOT_NULL_CHECK},
                )

            if validated is None:
                op.execute(
                    f"ALTER TABLE products ADD CONSTRAINT {NOT_NULL_CHECK} "
                    "CHECK (is_current IS NOT NULL) NOT VALID"
                )
            if not validated:
                op.execute(f"ALTER TABLE products VALIDATE CONSTRAINT {NOT_NULL_CHECK}")

            op.alter_column(
                "products",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=False,
            )
            op.execute(f"ALTER TABLE products DROP CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.alter_column(
                "products",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=True,
            )
        finally:
            op.execute("RESET lock_timeout")

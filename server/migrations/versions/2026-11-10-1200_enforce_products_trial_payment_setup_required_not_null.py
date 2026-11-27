"""enforce products.trial_payment_setup_required NOT NULL

Revision ID: 4d2b8e7a1c3f
Revises: 3bcb4b392997
Create Date: 2026-11-10 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4d2b8e7a1c3f"
down_revision = "3bcb4b392997"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "products_trial_payment_setup_required_not_null_check"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                "UPDATE products SET trial_payment_setup_required = true "
                "WHERE trial_payment_setup_required IS NULL"
            )

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
                    "CHECK (trial_payment_setup_required IS NOT NULL) NOT VALID"
                )
            if not validated:
                op.execute(f"ALTER TABLE products VALIDATE CONSTRAINT {NOT_NULL_CHECK}")

            op.alter_column(
                "products",
                "trial_payment_setup_required",
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
                "trial_payment_setup_required",
                existing_type=sa.Boolean(),
                nullable=True,
            )
        finally:
            op.execute("RESET lock_timeout")

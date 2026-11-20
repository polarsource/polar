"""enforce customers.type NOT NULL

Revision ID: 3c1e7a9d52f4
Revises: f3238e76d766
Create Date: 2026-11-20 10:46:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3c1e7a9d52f4"
down_revision = "f3238e76d766"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "customers_type_not_null_check"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # Every row has a type in production, and Customer.type sets
            # default=individual on ORM inserts, so this safety-net UPDATE
            # matches no rows.
            op.execute("UPDATE customers SET type = 'individual' WHERE type IS NULL")

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        "WHERE conname = :name "
                        "AND conrelid = 'customers'::regclass"
                    ),
                    {"name": NOT_NULL_CHECK},
                )

            if validated is None:
                op.execute(
                    f"ALTER TABLE customers ADD CONSTRAINT {NOT_NULL_CHECK} "
                    "CHECK (type IS NOT NULL) NOT VALID"
                )
            if not validated:
                op.execute(
                    f"ALTER TABLE customers VALIDATE CONSTRAINT {NOT_NULL_CHECK}"
                )

            op.alter_column(
                "customers",
                "type",
                existing_type=sa.String(),
                nullable=False,
            )
            op.execute(f"ALTER TABLE customers DROP CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.alter_column(
                "customers",
                "type",
                existing_type=sa.String(),
                nullable=True,
            )
        finally:
            op.execute("RESET lock_timeout")

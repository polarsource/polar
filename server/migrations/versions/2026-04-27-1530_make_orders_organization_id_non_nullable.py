"""Make orders.organization_id non nullable

Revision ID: b07286a34be3
Revises: f3a2b1c4d5e6
Create Date: 2026-04-27 09:40:38.765100

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b07286a34be3"
down_revision = "f3a2b1c4d5e6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Production is expected to have been backfilled via
    # scripts/backfill_order_organization_id.py before this migration runs;
    # this UPDATE is a safety net for local environments where the script
    # may not have been executed.
    op.execute(
        """
        UPDATE orders
           SET organization_id = customers.organization_id
          FROM customers
         WHERE orders.customer_id = customers.id
           AND orders.organization_id IS NULL
        """
    )

    # Use the NOT VALID / VALIDATE pattern to avoid a full-table ACCESS EXCLUSIVE
    # lock when setting NOT NULL.
    #
    # Step 1: add the check constraint as NOT VALID — takes only SHARE UPDATE
    #         EXCLUSIVE, so concurrent reads and writes are unblocked.
    op.execute(
        """
        ALTER TABLE orders
            ADD CONSTRAINT orders_organization_id_not_null
            CHECK (organization_id IS NOT NULL) NOT VALID
        """
    )

    # Step 2: validate the constraint — also SHARE UPDATE EXCLUSIVE.  Postgres
    #         scans the table for violations here, but concurrent DML is still
    #         allowed (it must simply not introduce new NULLs).
    op.execute(
        """
        ALTER TABLE orders
            VALIDATE CONSTRAINT orders_organization_id_not_null
        """
    )

    # Step 3: set NOT NULL — because a validated check constraint already proves
    #         no NULLs exist, Postgres 12+ skips the full table scan and holds
    #         ACCESS EXCLUSIVE for only a very short time.
    op.alter_column(
        "orders", "organization_id", existing_type=sa.UUID(), nullable=False
    )

    # Step 4: the check constraint is now redundant — the NOT NULL column
    #         constraint takes over.
    op.execute(
        """
        ALTER TABLE orders
            DROP CONSTRAINT orders_organization_id_not_null
        """
    )


def downgrade() -> None:
    op.alter_column("orders", "organization_id", existing_type=sa.UUID(), nullable=True)

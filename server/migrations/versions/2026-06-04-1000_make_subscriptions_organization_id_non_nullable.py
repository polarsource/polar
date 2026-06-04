"""Make subscriptions.organization_id non nullable

Revision ID: c9e9440f7d03
Revises: 5263a32cf4dd
Create Date: 2026-06-04 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c9e9440f7d03"
down_revision = "5263a32cf4dd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")

    # Production is expected to have been backfilled via
    # scripts/backfill_subscription_organization_id.py before this migration
    # runs; this UPDATE is a safety net for local environments where the script
    # may not have been executed.
    op.execute(
        """
        UPDATE subscriptions
           SET organization_id = products.organization_id
          FROM products
         WHERE subscriptions.product_id = products.id
           AND subscriptions.organization_id IS NULL
        """
    )

    # Use the NOT VALID / VALIDATE pattern to avoid a full-table ACCESS EXCLUSIVE
    # lock when setting NOT NULL.
    #
    # Step 1: add the check constraint as NOT VALID — takes only SHARE UPDATE
    #         EXCLUSIVE, so concurrent reads and writes are unblocked.
    op.execute(
        """
        ALTER TABLE subscriptions
            ADD CONSTRAINT subscriptions_organization_id_not_null
            CHECK (organization_id IS NOT NULL) NOT VALID
        """
    )

    # Step 2: validate the constraint — also SHARE UPDATE EXCLUSIVE.  Postgres
    #         scans the table for violations here, but concurrent DML is still
    #         allowed (it must simply not introduce new NULLs).
    op.execute(
        """
        ALTER TABLE subscriptions
            VALIDATE CONSTRAINT subscriptions_organization_id_not_null
        """
    )

    # Step 3: set NOT NULL — because a validated check constraint already proves
    #         no NULLs exist, Postgres 12+ skips the full table scan and holds
    #         ACCESS EXCLUSIVE for only a very short time.
    op.alter_column(
        "subscriptions", "organization_id", existing_type=sa.UUID(), nullable=False
    )

    # Step 4: the check constraint is now redundant — the NOT NULL column
    #         constraint takes over.
    op.execute(
        """
        ALTER TABLE subscriptions
            DROP CONSTRAINT subscriptions_organization_id_not_null
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "subscriptions", "organization_id", existing_type=sa.UUID(), nullable=True
    )

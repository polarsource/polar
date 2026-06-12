"""make benefit visibility non nullable

Revision ID: e5522ef4ec57
Revises: e70dad60eade
Create Date: 2026-06-10 23:11:11.149955

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e5522ef4ec57"
down_revision = "e70dad60eade"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")

    # Safety net: existing rows get visibility backfilled to 'public' by the
    # out-of-band, batched `scripts/backfill_benefit_visibility.py` before this
    # migration runs in production. This in-migration UPDATE covers any rows the
    # script missed (fresh/local/test/sandbox environments where it wasn't run),
    # so the constraint validation below can't fail on lingering NULLs. It's
    # idempotent and a no-op once the backfill has already run.
    op.execute(
        """
        UPDATE benefits
            SET visibility = 'public'
            WHERE visibility IS NULL
        """
    )

    # Use the NOT VALID / VALIDATE pattern to avoid a full-table ACCESS EXCLUSIVE
    # lock when setting NOT NULL.
    #
    # Step 1: add the check constraint as NOT VALID — takes only SHARE UPDATE
    #         EXCLUSIVE, so concurrent reads and writes are unblocked.
    op.execute(
        """
        ALTER TABLE benefits
            ADD CONSTRAINT benefits_visibility_not_null
            CHECK (visibility IS NOT NULL) NOT VALID
        """
    )

    # Step 2: validate the constraint — also SHARE UPDATE EXCLUSIVE.  Postgres
    #         scans the table for violations here, but concurrent DML is still
    #         allowed (it must simply not introduce new NULLs).
    op.execute(
        """
        ALTER TABLE benefits
            VALIDATE CONSTRAINT benefits_visibility_not_null
        """
    )

    # Step 3: set NOT NULL — because a validated check constraint already proves
    #         no NULLs exist, Postgres 12+ skips the full table scan and holds
    #         ACCESS EXCLUSIVE for only a very short time.
    op.alter_column(
        "benefits",
        "visibility",
        existing_type=sa.VARCHAR(),
        nullable=False,
    )

    # Step 4: the check constraint is now redundant — the NOT NULL column
    #         constraint takes over.
    op.execute(
        """
        ALTER TABLE benefits
            DROP CONSTRAINT benefits_visibility_not_null
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column("benefits", "visibility", existing_type=sa.VARCHAR(), nullable=True)

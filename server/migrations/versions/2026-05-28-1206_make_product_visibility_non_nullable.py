"""make product visibility non-nullable

Revision ID: 0c12d2aaab31
Revises: 706d2bab5ee4
Create Date: 2026-05-28 12:06:22.931905

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "0c12d2aaab31"
down_revision = "706d2bab5ee4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Use the NOT VALID / VALIDATE pattern to avoid a full-table ACCESS EXCLUSIVE
    # lock when setting NOT NULL.
    #
    # Step 1: add the check constraint as NOT VALID — takes only SHARE UPDATE
    #         EXCLUSIVE, so concurrent reads and writes are unblocked.
    op.execute(
        """
        ALTER TABLE products
            ADD CONSTRAINT products_visibility_not_null
            CHECK (visibility IS NOT NULL) NOT VALID
        """
    )

    # Step 2: validate the constraint — also SHARE UPDATE EXCLUSIVE.  Postgres
    #         scans the table for violations here, but concurrent DML is still
    #         allowed (it must simply not introduce new NULLs).
    op.execute(
        """
        ALTER TABLE products
            VALIDATE CONSTRAINT products_visibility_not_null
        """
    )

    # Step 3: set NOT NULL — because a validated check constraint already proves
    #         no NULLs exist, Postgres 12+ skips the full table scan and holds
    #         ACCESS EXCLUSIVE for only a very short time.
    op.alter_column(
        "products",
        "visibility",
        existing_type=sa.VARCHAR(),
        nullable=False,
        existing_server_default=sa.text("'public'::character varying"),
    )

    # Step 4: the check constraint is now redundant — the NOT NULL column
    #         constraint takes over.
    op.execute(
        """
        ALTER TABLE products
            DROP CONSTRAINT products_visibility_not_null
        """
    )


def downgrade() -> None:
    op.alter_column(
        "products",
        "visibility",
        existing_type=sa.VARCHAR(),
        nullable=True,
        existing_server_default=sa.text("'public'::character varying"),
    )

"""downloadables member-level uniqueness

Revision ID: 46c188b1734f
Revises: 296b2161f0de
Create Date: 2026-06-24 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "46c188b1734f"
down_revision = "296b2161f0de"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

NEW_INDEX = "ix_downloadables_scope_unique"
CUSTOMER_INDEX = "ix_downloadables_customer_id"
OLD_CONSTRAINT = "downloadables_customer_id_file_id_benefit_id_key"


def upgrade() -> None:
    # Move uniqueness from the customer level to the member level so each member
    # holding the benefit gets their own downloadable row, like benefit grants.
    # NULLS NOT DISTINCT keeps customer-level (member_id IS NULL) rows idempotent
    # for products without members. Built CONCURRENTLY to avoid locking the table;
    # it coexists with the old constraint until the swap below.
    # The per-member backfill of existing rows lives in
    # scripts/backfill_member_downloadables.py (run as a one-off job).
    with op.get_context().autocommit_block():
        # A previously-interrupted concurrent build leaves an INVALID index of the
        # same name; drop it first so a re-run doesn't fail on "already exists".
        op.drop_index(
            NEW_INDEX,
            table_name="downloadables",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            NEW_INDEX,
            "downloadables",
            ["customer_id", "member_id", "file_id", "benefit_id"],
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )
        # The new scope index is partial, so it no longer fully covers
        # customer_id (cascade deletes, soft-deleted lookups). Add a full index
        # before dropping the old constraint so coverage is never lost.
        op.drop_index(
            CUSTOMER_INDEX,
            table_name="downloadables",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            CUSTOMER_INDEX,
            "downloadables",
            ["customer_id"],
            postgresql_concurrently=True,
        )

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(OLD_CONSTRAINT, "downloadables", type_="unique")


def downgrade() -> None:
    # Operationally gated rollback: reverting to customer-level uniqueness only
    # works once per-member rows have been collapsed to one row per
    # (customer, file, benefit). We deliberately do NOT mass-delete here — if
    # duplicates remain, recreating the constraint fails loudly rather than
    # silently dropping member downloadables. Runs as a single transaction, so a
    # failure rolls back to the member-aware index and never leaves the table
    # without a uniqueness guard. This is the rarely-run rollback path; the live
    # forward deploy is the upgrade above. lock_timeout bounds lock waits.
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Restore the old constraint before dropping the member-aware indexes, all in
    # one transaction, so a failure rolls back to the member-aware index and
    # never leaves the table without a uniqueness guard.
    op.create_unique_constraint(
        OLD_CONSTRAINT,
        "downloadables",
        ["customer_id", "file_id", "benefit_id"],
    )
    # The restored non-partial constraint provides uniqueness and customer_id
    # coverage (leading column) again, so the member-aware indexes can go.
    op.drop_index(NEW_INDEX, table_name="downloadables")
    op.drop_index(CUSTOMER_INDEX, table_name="downloadables")

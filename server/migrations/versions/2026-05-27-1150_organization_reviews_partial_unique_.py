"""organization_reviews_partial_unique_index

Revision ID: a102bf8a2204
Revises: dd1a9c1f39c0
Create Date: 2026-05-27 11:50:15.163992

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a102bf8a2204"
down_revision = "dd1a9c1f39c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Swap the total unique index on organization_id for a partial one
    # (WHERE deleted_at IS NULL) — the established Polar pattern for
    # soft-deletable models with per-parent uniqueness (see e.g.
    # discount_ignore_soft_deletes, add_partial_unique_owner_index).
    # The total form made INSERTs collide with soft-deleted rows and
    # DLQed the SUBMISSION worker after a grandfather-style cleanup.
    #
    # Done CONCURRENTLY so no table-level write lock at any point.
    # `CONCURRENTLY` cannot run inside a transaction, so each step runs
    # in its own transaction via `autocommit_block`. That means a
    # failure between steps cannot be rolled back automatically — so
    # every statement here is written to be safely re-runnable:
    #
    #   step 1 — drop any prior `_new` index from a failed attempt
    #            (handles the case where CREATE CONCURRENTLY crashed
    #            mid-build and left an INVALID index behind);
    #   step 2 — build the new partial unique index under a temp name;
    #   step 3 — drop the old total unique index (IF EXISTS, so a
    #            second run after a previous successful drop is a no-op);
    #   step 4 — rename the new index to the canonical name (IF EXISTS,
    #            same reasoning).
    #
    # If the migration fails between any two steps, the next deploy
    # re-runs the same migration and each step is either a no-op or
    # safely restarts from a known state.
    with op.get_context().autocommit_block():
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS "
            "ix_organization_reviews_organization_id_new"
        )
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY "
            "ix_organization_reviews_organization_id_new "
            "ON organization_reviews (organization_id) "
            "WHERE deleted_at IS NULL"
        )
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_organization_reviews_organization_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS "
            "ix_organization_reviews_organization_id_new "
            "RENAME TO ix_organization_reviews_organization_id"
        )


def downgrade() -> None:
    # Mirror image of upgrade — re-create the total unique index under
    # a temp name, drop the partial, rename back. Same re-runnability
    # discipline. NOTE: the CREATE will fail if any organization has
    # both a live and a soft-deleted review row by the time downgrade
    # runs; that's intentional — the data state would need to be
    # cleaned up before reverting the swap.
    with op.get_context().autocommit_block():
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS "
            "ix_organization_reviews_organization_id_old"
        )
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY "
            "ix_organization_reviews_organization_id_old "
            "ON organization_reviews (organization_id)"
        )
        op.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_organization_reviews_organization_id"
        )
        op.execute(
            "ALTER INDEX IF EXISTS "
            "ix_organization_reviews_organization_id_old "
            "RENAME TO ix_organization_reviews_organization_id"
        )

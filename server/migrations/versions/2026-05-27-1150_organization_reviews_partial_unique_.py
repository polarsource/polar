"""organization_reviews_partial_unique_index

Revision ID: a102bf8a2204
Revises: 1635867d733d
Create Date: 2026-05-27 11:50:15.163992

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a102bf8a2204"
down_revision = "1635867d733d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Swap the total unique index on organization_id for a partial one
    # (WHERE deleted_at IS NULL). The total form blocked re-INSERTs after
    # soft-deleted rows accumulated. Same pattern as
    # add_partial_unique_owner_index and discount_ignore_soft_deletes.
    #
    # CONCURRENTLY requires autocommit_block. Steps are idempotent
    # (IF EXISTS guards + temp _new name), so a failed deploy retries
    # cleanly.
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

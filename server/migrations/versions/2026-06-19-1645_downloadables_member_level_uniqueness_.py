"""downloadables member-level uniqueness

Revision ID: 46c188b1734f
Revises: 54267f23e641
Create Date: 2026-06-19 16:45:39.548649

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "46c188b1734f"
down_revision = "54267f23e641"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

NEW_INDEX = "ix_downloadables_scope_unique"
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

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(OLD_CONSTRAINT, "downloadables", type_="unique")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            NEW_INDEX,
            table_name="downloadables",
            postgresql_concurrently=True,
        )

    op.execute("SET LOCAL lock_timeout = '5s'")
    # The per-member rows would violate the customer-level constraint; keep one
    # row per (customer, file, benefit) so the constraint can be restored,
    # preferring live rows over soft-deleted ones, then oldest.
    op.execute(
        """
        DELETE FROM downloadables d
        USING (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY customer_id, file_id, benefit_id
                       ORDER BY (deleted_at IS NOT NULL), created_at, id
                   ) AS rn
            FROM downloadables
        ) dup
        WHERE d.id = dup.id AND dup.rn > 1
        """
    )
    op.create_unique_constraint(
        OLD_CONSTRAINT,
        "downloadables",
        ["customer_id", "file_id", "benefit_id"],
    )

"""free external_id on deleted customers

Revision ID: c7e4b21f9a35
Revises: 8f3d1c4a9e21
Create Date: 2026-07-30 09:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c7e4b21f9a35"
down_revision = "8f3d1c4a9e21"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

BATCH_SIZE = 1000

# Customers deleted with `anonymize=true` kept their `external_id`, and the unique
# constraint on `(organization_id, external_id)` doesn't account for `deleted_at`.
# Those external IDs are therefore locked forever, with no way to recycle them.
# Move them to `user_metadata`, exactly like the deletion code now does.
BACKFILL_STATEMENT = sa.text(
    """
    WITH batch AS (
        SELECT id
        FROM customers
        WHERE deleted_at IS NOT NULL AND external_id IS NOT NULL
        LIMIT :batch_size
    )
    UPDATE customers
    SET
        user_metadata = customers.user_metadata
            || jsonb_build_object('__external_id', customers.external_id),
        external_id = NULL
    FROM batch
    WHERE customers.id = batch.id
    """
)


def upgrade() -> None:
    # Batched outside a transaction: `customers` is a busy table and this may
    # touch a large number of rows.
    with op.get_context().autocommit_block():
        connection = op.get_bind()
        while True:
            result = connection.execute(BACKFILL_STATEMENT, {"batch_size": BATCH_SIZE})
            if result.rowcount == 0:
                break


def downgrade() -> None:
    # Not reversible: restoring `external_id` could conflict with a customer that
    # has since recycled it. The original values remain in `user_metadata`.
    pass

"""index members on organization_id lower(email), drop redundant case-sensitive index

Revision ID: 382c4661fdb2
Revises: a0bc64d272f1
Create Date: 2026-09-10 13:02:04.903463

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "382c4661fdb2"
down_revision = "a0bc64d272f1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NEW_INDEX_NAME = "ix_members_organization_id_lower_email_active"
REDUNDANT_INDEX_NAME = "members_customer_id_email_active_key"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Support customer-portal lookups by organization + case-insensitive
        # email. Existing indexes are all customer_id-leading, so a query
        # filtering on (organization_id, lower(email)) can't use them and falls
        # back to scanning every active member in the org.
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            NEW_INDEX_NAME,
            table_name="members",
            postgresql_concurrently=True,
            if_exists=True,
        )
        op.create_index(
            NEW_INDEX_NAME,
            "members",
            ["organization_id", sa.text("lower(email)")],
            unique=False,
            postgresql_where=sa.text("deleted_at IS NULL"),
            postgresql_concurrently=True,
            if_not_exists=True,
        )
        # Drop the redundant case-sensitive (customer_id, email) unique index.
        # It only exists on databases predating the June 2026 squash (the squash
        # creates only the case-insensitive variant), and the case-insensitive
        # unique index enforces a strictly stronger constraint. if_exists keeps
        # this a no-op on databases that never had it.
        op.drop_index(
            REDUNDANT_INDEX_NAME,
            table_name="members",
            postgresql_concurrently=True,
            if_exists=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            NEW_INDEX_NAME,
            table_name="members",
            postgresql_concurrently=True,
            if_exists=True,
        )
        # The case-sensitive index was a legacy, prod-only artifact not
        # represented in the schema, so it is intentionally not recreated here.

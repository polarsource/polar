"""member_owner_partial_unique_index

Revision ID: befcfa872c35
Revises: f96e4424ec70
Create Date: 2026-04-22 09:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "befcfa872c35"
down_revision = "f96e4424ec70"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Fail fast if the brief catalog ACCESS EXCLUSIVE locks can't be
        # acquired (e.g., another DDL or VACUUM FULL is in flight). No
        # statement_timeout: killing CONCURRENTLY mid-build leaves an
        # INVALID index that still enforces uniqueness.
        op.execute("SET lock_timeout = '5s'")
        op.create_index(
            "members_customer_id_owner_active_key",
            "members",
            ["customer_id"],
            unique=True,
            postgresql_where="deleted_at IS NULL AND role = 'owner'",
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.drop_index(
            "members_customer_id_owner_active_key",
            table_name="members",
            postgresql_concurrently=True,
        )

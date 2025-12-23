"""Fix user email index to exclude soft-deleted users

Revision ID: a1b2c3d4e5f6
Revises: 916e176efd47
Create Date: 2025-12-23 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "916e176efd47"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Drop the old unique index that doesn't account for soft deletes
    op.drop_index("ix_users_email_case_insensitive", table_name="users")

    # Create a new partial unique index that only applies to non-deleted users
    # This allows soft-deleted users to have duplicate emails while maintaining
    # uniqueness for active users
    op.create_index(
        "ix_users_email_case_insensitive",
        "users",
        [sa.literal_column("lower(email)")],
        unique=True,
        postgresql_where=sa.literal_column("deleted_at IS NULL"),
    )


def downgrade() -> None:
    # Cannot safely downgrade this change.
    #
    # We cannot re-introduce a unique index without the soft-delete filter since
    # we could have multiple users with the same email after the upgrade (active
    # user + soft-deleted users), and the old index would reject that.
    #
    # Any revert would need to first clean up duplicate emails from soft-deleted
    # records.
    ...

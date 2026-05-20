"""Drop accounts.admin_id

Revision ID: fc013555b132
Revises: dd87a0bf956a
Create Date: 2026-05-20 15:05:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "fc013555b132"
down_revision = "dd87a0bf956a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '2s'")
    op.drop_column("accounts", "admin_id")


def downgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("admin_id", sa.Uuid(), nullable=True),
    )
    # Backfill from `user_organizations` to preserve the previous invariant
    # "Account.admin_id matches the user holding `owner` on at least one of
    # the account's organizations".
    op.execute(
        """
        UPDATE accounts AS a
        SET admin_id = uo.user_id
        FROM organizations AS o
        JOIN user_organizations AS uo
          ON uo.organization_id = o.id
         AND uo.role = 'owner'
         AND uo.deleted_at IS NULL
        WHERE o.account_id = a.id
          AND a.admin_id IS NULL
        """
    )
    op.create_foreign_key(
        "accounts_admin_id_fkey",
        "accounts",
        "users",
        ["admin_id"],
        ["id"],
        use_alter=True,
    )

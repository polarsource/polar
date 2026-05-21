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
    op.drop_constraint(op.f("accounts_admin_id_fkey"), "accounts", type_="foreignkey")
    op.drop_column("accounts", "admin_id")


def downgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("admin_id", sa.UUID(), autoincrement=False, nullable=True),
    )
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
        op.f("accounts_admin_id_fkey"), "accounts", "users", ["admin_id"], ["id"]
    )

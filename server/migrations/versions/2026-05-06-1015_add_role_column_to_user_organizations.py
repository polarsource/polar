"""add role column to user_organizations

Revision ID: d0d27f5aa3cc
Revises: 199179085ab4
Create Date: 2026-05-06 10:15:09.141786

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d0d27f5aa3cc"
down_revision = "199179085ab4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '2s'")

    # 1. Add the column nullable so existing rows aren't blocked.
    op.add_column(
        "user_organizations",
        sa.Column("role", sa.String(), nullable=True),
    )

    # 2. Backfill everyone to `member` first.
    op.execute("UPDATE user_organizations SET role = 'member'")

    # 3. Promote the user identified by `Account.admin_id` to `owner`.
    #    Deliberately includes soft-deleted Organization and UserOrganization
    #    rows: the invariant "the user identified by Account.admin_id carries
    #    role 'owner'" should hold for historical data integrity too.
    op.execute(
        """
        UPDATE user_organizations AS uo
        SET role = 'owner'
        FROM organizations AS o
        JOIN accounts AS a ON a.id = o.account_id
        WHERE uo.organization_id = o.id
          AND uo.user_id = a.admin_id
        """
    )

    # 4. Tighten the column.
    op.alter_column("user_organizations", "role", nullable=False)


def downgrade() -> None:
    op.drop_column("user_organizations", "role")

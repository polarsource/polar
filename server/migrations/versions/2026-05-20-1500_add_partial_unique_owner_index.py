"""Add partial unique index on user_organizations.owner

Revision ID: dd87a0bf956a
Revises: 69a2e3ae542c
Create Date: 2026-05-20 15:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "dd87a0bf956a"
down_revision = "69a2e3ae542c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Guards the invariant "at most one owner per organization" once
    # `Account.admin_id` is no longer the source of truth.
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_user_organizations_owner_per_org"),
            "user_organizations",
            ["organization_id"],
            unique=True,
            postgresql_concurrently=True,
            postgresql_where="role = 'owner' AND deleted_at IS NULL",
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            op.f("ix_user_organizations_owner_per_org"),
            table_name="user_organizations",
            postgresql_concurrently=True,
        )

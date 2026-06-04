"""add organization_id to subscriptions

Revision ID: 5263a32cf4dd
Revises: 4c80966d7217
Create Date: 2026-06-03 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5263a32cf4dd"
down_revision = "4c80966d7217"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("subscriptions_organization_id_fkey"),
        "subscriptions",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="restrict",
    )
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        op.create_index(
            op.f("ix_subscriptions_organization_id"),
            "subscriptions",
            ["organization_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("subscriptions_organization_id_fkey"),
        "subscriptions",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_subscriptions_organization_id"), table_name="subscriptions")
    op.drop_column("subscriptions", "organization_id")

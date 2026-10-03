"""add subscription_update_id to discount_redemptions

Revision ID: 21d1c9f67a91
Revises: 43bfb6e78c72
Create Date: 2026-09-25 15:16:35.757138

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "21d1c9f67a91"
down_revision = "43bfb6e78c72"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_discount_redemptions_subscription_update_id"


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "discount_redemptions",
        sa.Column("subscription_update_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("discount_redemptions_subscription_update_id_fkey"),
        "discount_redemptions",
        "subscription_updates",
        ["subscription_update_id"],
        ["id"],
        ondelete="set null",
    )

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="discount_redemptions",
                postgresql_concurrently=True,
                if_exists=True,
            )
            op.create_index(
                INDEX_NAME,
                "discount_redemptions",
                ["subscription_update_id"],
                unique=False,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="discount_redemptions",
                postgresql_concurrently=True,
                if_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("discount_redemptions_subscription_update_id_fkey"),
        "discount_redemptions",
        type_="foreignkey",
    )
    op.drop_column("discount_redemptions", "subscription_update_id")

"""Remove SubscriptionGroup and add SubscriptionTier.type

Revision ID: 2012740f4936
Revises: 0e8ac95d24a7
Create Date: 2023-10-18 15:51:11.796180

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "2012740f4936"
down_revision = "0e8ac95d24a7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###

    # Delete everything before migration, those features weren't live anyway
    op.execute("DELETE FROM subscription WHERE TRUE")
    op.execute("DELETE FROM subscription_tiers WHERE TRUE")

    # Rename "subscription" -> "subscriptions"
    op.create_table(
        "subscriptions",
        sa.Column("stripe_subscription_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("current_period_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("current_period_end", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("price_currency", sa.String(length=3), nullable=False),
        sa.Column("price_amount", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("subscription_tier_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["subscription_tier_id"],
            ["subscription_tiers.id"],
            name=op.f("subscriptions_subscription_tier_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("subscriptions_user_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("subscriptions_pkey")),
    )
    op.create_index(
        op.f("ix_subscriptions_stripe_subscription_id"),
        "subscriptions",
        ["stripe_subscription_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_subscriptions_subscription_tier_id"),
        "subscriptions",
        ["subscription_tier_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_subscriptions_user_id"), "subscriptions", ["user_id"], unique=False
    )
    op.drop_index("ix_subscription_stripe_subscription_id", table_name="subscription")
    op.drop_index("ix_subscription_subscription_tier_id", table_name="subscription")
    op.drop_index("ix_subscription_user_id", table_name="subscription")
    op.drop_table("subscription")

    # Drop subscription_groups
    op.drop_constraint(
        "subscription_tiers_subscription_group_id_fkey",
        "subscription_tiers",
        type_="foreignkey",
    )
    op.drop_table("subscription_groups")
    op.add_column("subscription_tiers", sa.Column("type", sa.String(), nullable=False))
    op.add_column(
        "subscription_tiers", sa.Column("organization_id", sa.UUID(), nullable=True)
    )
    op.add_column(
        "subscription_tiers", sa.Column("repository_id", sa.UUID(), nullable=True)
    )
    op.create_index(
        op.f("ix_subscription_tiers_type"), "subscription_tiers", ["type"], unique=False
    )

    op.create_foreign_key(
        op.f("subscription_tiers_organization_id_fkey"),
        "subscription_tiers",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="cascade",
    )
    op.create_foreign_key(
        op.f("subscription_tiers_repository_id_fkey"),
        "subscription_tiers",
        "repositories",
        ["repository_id"],
        ["id"],
        ondelete="cascade",
    )
    op.drop_column("subscription_tiers", "subscription_group_id")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "subscription_tiers",
        sa.Column(
            "subscription_group_id", sa.UUID(), autoincrement=False, nullable=False
        ),
    )
    op.drop_constraint(
        op.f("subscription_tiers_repository_id_fkey"),
        "subscription_tiers",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("subscription_tiers_organization_id_fkey"),
        "subscription_tiers",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "subscription_tiers_subscription_group_id_fkey",
        "subscription_tiers",
        "subscription_groups",
        ["subscription_group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_subscription_tiers_type"), table_name="subscription_tiers")
    op.drop_column("subscription_tiers", "repository_id")
    op.drop_column("subscription_tiers", "organization_id")
    op.drop_column("subscription_tiers", "type")
    op.create_table(
        "subscription_groups",
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("order", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("repository_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("description", sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column("icon", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("color", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name="subscription_groups_organization_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["repository_id"],
            ["repositories.id"],
            name="subscription_groups_repository_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="subscription_groups_pkey"),
        postgresql_ignore_search_path=False,
    )
    op.create_table(
        "subscription",
        sa.Column(
            "stripe_subscription_id", sa.VARCHAR(), autoincrement=False, nullable=False
        ),
        sa.Column("status", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column(
            "current_period_start",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "current_period_end",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "cancel_at_period_end", sa.BOOLEAN(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "ended_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "price_currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False
        ),
        sa.Column("price_amount", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "subscription_tier_id", sa.UUID(), autoincrement=False, nullable=False
        ),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["subscription_tier_id"],
            ["subscription_tiers.id"],
            name="subscription_subscription_tier_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="subscription_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="subscription_pkey"),
    )
    op.create_index(
        "ix_subscription_user_id", "subscription", ["user_id"], unique=False
    )
    op.create_index(
        "ix_subscription_subscription_tier_id",
        "subscription",
        ["subscription_tier_id"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_stripe_subscription_id",
        "subscription",
        ["stripe_subscription_id"],
        unique=False,
    )
    op.drop_index(op.f("ix_subscriptions_user_id"), table_name="subscriptions")
    op.drop_index(
        op.f("ix_subscriptions_subscription_tier_id"), table_name="subscriptions"
    )
    op.drop_index(
        op.f("ix_subscriptions_stripe_subscription_id"), table_name="subscriptions"
    )
    op.drop_table("subscriptions")
    # ### end Alembic commands ###

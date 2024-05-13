"""Rename SubscriptionTier* models to Product*

Revision ID: e437db540330
Revises: 22b6469a1294
Create Date: 2024-05-13 15:56:56.441892

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "e437db540330"
down_revision = "22b6469a1294"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Rename tables
    op.rename_table("subscription_tiers", "products")
    op.rename_table("subscription_tier_prices", "product_prices")
    op.rename_table("subscription_tier_benefits", "product_benefits")

    # ProductPrice
    op.alter_column(
        "product_prices",
        "subscription_tier_id",
        new_column_name="product_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # ProductBenefit
    op.alter_column(
        "product_benefits",
        "subscription_tier_id",
        new_column_name="product_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # HeldBalance
    op.alter_column(
        "held_balances",
        "subscription_tier_price_id",
        new_column_name="product_price_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=True,
    )

    # Subscription
    op.alter_column(
        "subscriptions",
        "subscription_tier_id",
        new_column_name="product_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # Transaction
    op.alter_column(
        "transactions",
        "subscription_tier_price_id",
        new_column_name="product_price_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=True,
    )

    # Recreate indexes
    op.drop_index(
        "ix_held_balances_subscription_tier_price_id", table_name="held_balances"
    )
    op.create_index(
        op.f("ix_held_balances_product_price_id"),
        "held_balances",
        ["product_price_id"],
        unique=False,
    )
    op.drop_index(
        "ix_subscription_tier_benefits_created_at", table_name="product_benefits"
    )
    op.drop_index(
        "ix_subscription_tier_benefits_deleted_at", table_name="product_benefits"
    )
    op.drop_index(
        "ix_subscription_tier_benefits_modified_at", table_name="product_benefits"
    )
    op.drop_index("ix_subscription_tier_benefits_order", table_name="product_benefits")
    op.drop_constraint(
        "subscription_tier_benefits_subscription_tier_id_order_key",
        "product_benefits",
        type_="unique",
    )
    op.create_index(
        op.f("ix_product_benefits_created_at"),
        "product_benefits",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_benefits_deleted_at"),
        "product_benefits",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_benefits_modified_at"),
        "product_benefits",
        ["modified_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_benefits_order"), "product_benefits", ["order"], unique=False
    )
    op.create_unique_constraint(
        op.f("product_benefits_product_id_order_key"),
        "product_benefits",
        ["product_id", "order"],
    )
    op.drop_index("ix_subscription_tier_prices_created_at", table_name="product_prices")
    op.drop_index("ix_subscription_tier_prices_deleted_at", table_name="product_prices")
    op.drop_index(
        "ix_subscription_tier_prices_modified_at", table_name="product_prices"
    )
    op.drop_index(
        "ix_subscription_tier_prices_recurring_interval", table_name="product_prices"
    )
    op.create_index(
        op.f("ix_product_prices_created_at"),
        "product_prices",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_prices_deleted_at"),
        "product_prices",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_prices_modified_at"),
        "product_prices",
        ["modified_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_product_prices_recurring_interval"),
        "product_prices",
        ["recurring_interval"],
        unique=False,
    )
    op.drop_index("ix_subscription_tiers_created_at", table_name="products")
    op.drop_index("ix_subscription_tiers_deleted_at", table_name="products")
    op.drop_index("ix_subscription_tiers_is_highlighted", table_name="products")
    op.drop_index("ix_subscription_tiers_modified_at", table_name="products")
    op.drop_index("ix_subscription_tiers_stripe_product_id", table_name="products")
    op.drop_index("ix_subscription_tiers_type", table_name="products")
    op.create_index(
        op.f("ix_products_created_at"), "products", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_products_deleted_at"), "products", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_products_is_highlighted"), "products", ["is_highlighted"], unique=False
    )
    op.create_index(
        op.f("ix_products_modified_at"), "products", ["modified_at"], unique=False
    )
    op.create_index(
        op.f("ix_products_stripe_product_id"),
        "products",
        ["stripe_product_id"],
        unique=False,
    )
    op.create_index(op.f("ix_products_type"), "products", ["type"], unique=False)
    op.drop_index("ix_subscriptions_subscription_tier_id", table_name="subscriptions")
    op.create_index(
        op.f("ix_subscriptions_product_id"),
        "subscriptions",
        ["product_id"],
        unique=False,
    )
    op.drop_index(
        "ix_transactions_subscription_tier_price_id", table_name="transactions"
    )
    op.create_index(
        op.f("ix_transactions_product_price_id"),
        "transactions",
        ["product_price_id"],
        unique=False,
    )


def downgrade() -> None:
    # Recreate indexes
    op.drop_index(op.f("ix_transactions_product_price_id"), table_name="transactions")
    op.create_index(
        "ix_transactions_subscription_tier_price_id",
        "transactions",
        ["product_price_id"],
        unique=False,
    )
    op.drop_index(op.f("ix_subscriptions_product_id"), table_name="subscriptions")
    op.create_index(
        "ix_subscriptions_subscription_tier_id",
        "subscriptions",
        ["product_id"],
        unique=False,
    )
    op.drop_index(op.f("ix_products_type"), table_name="products")
    op.drop_index(op.f("ix_products_stripe_product_id"), table_name="products")
    op.drop_index(op.f("ix_products_modified_at"), table_name="products")
    op.drop_index(op.f("ix_products_is_highlighted"), table_name="products")
    op.drop_index(op.f("ix_products_deleted_at"), table_name="products")
    op.drop_index(op.f("ix_products_created_at"), table_name="products")
    op.create_index("ix_subscription_tiers_type", "products", ["type"], unique=False)
    op.create_index(
        "ix_subscription_tiers_stripe_product_id",
        "products",
        ["stripe_product_id"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tiers_modified_at", "products", ["modified_at"], unique=False
    )
    op.create_index(
        "ix_subscription_tiers_is_highlighted",
        "products",
        ["is_highlighted"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tiers_deleted_at", "products", ["deleted_at"], unique=False
    )
    op.create_index(
        "ix_subscription_tiers_created_at", "products", ["created_at"], unique=False
    )
    op.drop_index(
        op.f("ix_product_prices_recurring_interval"), table_name="product_prices"
    )
    op.drop_index(op.f("ix_product_prices_modified_at"), table_name="product_prices")
    op.drop_index(op.f("ix_product_prices_deleted_at"), table_name="product_prices")
    op.drop_index(op.f("ix_product_prices_created_at"), table_name="product_prices")
    op.create_index(
        "ix_subscription_tier_prices_recurring_interval",
        "product_prices",
        ["recurring_interval"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_prices_modified_at",
        "product_prices",
        ["modified_at"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_prices_deleted_at",
        "product_prices",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_prices_created_at",
        "product_prices",
        ["created_at"],
        unique=False,
    )
    op.drop_constraint(
        op.f("product_benefits_product_id_order_key"),
        "product_benefits",
        type_="unique",
    )
    op.drop_index(op.f("ix_product_benefits_order"), table_name="product_benefits")
    op.drop_index(
        op.f("ix_product_benefits_modified_at"), table_name="product_benefits"
    )
    op.drop_index(op.f("ix_product_benefits_deleted_at"), table_name="product_benefits")
    op.drop_index(op.f("ix_product_benefits_created_at"), table_name="product_benefits")
    op.create_unique_constraint(
        "subscription_tier_benefits_subscription_tier_id_order_key",
        "product_benefits",
        ["product_id", "order"],
    )
    op.create_index(
        "ix_subscription_tier_benefits_order",
        "product_benefits",
        ["order"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_benefits_modified_at",
        "product_benefits",
        ["modified_at"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_benefits_deleted_at",
        "product_benefits",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_subscription_tier_benefits_created_at",
        "product_benefits",
        ["created_at"],
        unique=False,
    )
    op.drop_index(op.f("ix_held_balances_product_price_id"), table_name="held_balances")
    op.create_index(
        "ix_held_balances_subscription_tier_price_id",
        "held_balances",
        ["product_price_id"],
        unique=False,
    )

    # Transaction
    op.alter_column(
        "transactions",
        "product_price_id",
        new_column_name="subscription_tier_price_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=True,
    )

    # Subscription
    op.alter_column(
        "subscriptions",
        "product_id",
        new_column_name="subscription_tier_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # HeldBalance
    op.alter_column(
        "held_balances",
        "product_price_id",
        new_column_name="subscription_tier_price_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=True,
    )

    # ProductBenefit
    op.alter_column(
        "product_benefits",
        "product_id",
        new_column_name="subscription_tier_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # ProductPrice
    op.alter_column(
        "product_prices",
        "product_id",
        new_column_name="subscription_tier_id",
        type_=PostgresUUID,
        existing_type=PostgresUUID,
        existing_nullable=False,
    )

    # Rename tables
    op.rename_table("products", "subscription_tiers")
    op.rename_table("product_prices", "subscription_tier_prices")
    op.rename_table("product_benefits", "subscription_tier_benefits")

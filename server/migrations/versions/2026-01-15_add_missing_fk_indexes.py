"""Add missing FK indexes

Revision ID: 29aafbbcbe45
Revises: 9c8d7e6f5a4b
Create Date: 2026-01-15

"""

from alembic import op

revision = "29aafbbcbe45"
down_revision = "9c8d7e6f5a4b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_discount_redemptions_discount_id"),
            "discount_redemptions",
            ["discount_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_discount_redemptions_checkout_id"),
            "discount_redemptions",
            ["checkout_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_discount_redemptions_subscription_id"),
            "discount_redemptions",
            ["subscription_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_orders_discount_id"),
            "orders",
            ["discount_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_orders_subscription_id"),
            "orders",
            ["subscription_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_subscriptions_discount_id"),
            "subscriptions",
            ["discount_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_subscriptions_payment_method_id"),
            "subscriptions",
            ["payment_method_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_customers_default_payment_method_id"),
            "customers",
            ["default_payment_method_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_refunds_pledge_id"),
            "refunds",
            ["pledge_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_refunds_dispute_id"),
            "refunds",
            ["dispute_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_refunds_dispute_id"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_pledge_id"), table_name="refunds")
    op.drop_index(
        op.f("ix_customers_default_payment_method_id"), table_name="customers"
    )
    op.drop_index(
        op.f("ix_subscriptions_payment_method_id"), table_name="subscriptions"
    )
    op.drop_index(op.f("ix_subscriptions_discount_id"), table_name="subscriptions")
    op.drop_index(op.f("ix_orders_subscription_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_discount_id"), table_name="orders")
    op.drop_index(
        op.f("ix_discount_redemptions_subscription_id"),
        table_name="discount_redemptions",
    )
    op.drop_index(
        op.f("ix_discount_redemptions_checkout_id"), table_name="discount_redemptions"
    )
    op.drop_index(
        op.f("ix_discount_redemptions_discount_id"), table_name="discount_redemptions"
    )

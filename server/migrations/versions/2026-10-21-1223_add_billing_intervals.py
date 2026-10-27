"""Add billing intervals

Revision ID: b862e002ad65
Revises: 387e0ff257d4
Create Date: 2026-10-21 12:23:07.853617+02:00

"""

import sqlalchemy as sa
from alembic import op

revision = "b862e002ad65"
down_revision = "387e0ff257d4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.create_table(
        "billing_intervals",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("subscription_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("meter_id", sa.Uuid(), nullable=False),
        sa.Column("product_price_id", sa.Uuid(), nullable=False),
        sa.Column("period_start", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("period_end", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("usage_policy", sa.String(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("billing_intervals_customer_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["meter_id"], ["meters.id"], name=op.f("billing_intervals_meter_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("billing_intervals_organization_id_fkey"),
            ondelete="restrict",
        ),
        sa.ForeignKeyConstraint(
            ["product_price_id"],
            ["product_prices.id"],
            name=op.f("billing_intervals_product_price_id_fkey"),
            ondelete="restrict",
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["subscriptions.id"],
            name=op.f("billing_intervals_subscription_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("billing_intervals_pkey")),
        sa.UniqueConstraint(
            "subscription_id",
            "meter_id",
            "period_start",
            name=op.f("billing_intervals_subscription_id_meter_id_period_start_key"),
        ),
    )
    op.create_index(
        "ix_billing_intervals_open_stream",
        "billing_intervals",
        ["subscription_id", "meter_id"],
        unique=True,
        postgresql_where=sa.text("period_end IS NULL"),
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_index("ix_billing_intervals_open_stream", table_name="billing_intervals")
    op.drop_table("billing_intervals")

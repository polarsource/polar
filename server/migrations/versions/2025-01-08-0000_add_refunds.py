"""add refunds

Revision ID: 9c158a0aadf5
Revises: c996df1d397f
Create Date: 2025-01-08 00:00:57.577987

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9c158a0aadf5"
down_revision = "c996df1d397f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

###############################################################################
# UPGRADE
###############################################################################


def upgrade() -> None:
    create_refund_table()
    upgrade_order_table()
    backfill_refunds()
    backfill_orders()


def create_refund_table() -> None:
    op.create_table(
        "refunds",
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("tax_amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("comment", sa.String(), nullable=True),
        sa.Column("failure_reason", sa.String(), nullable=True),
        sa.Column(
            "destination_details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("stripe_id", sa.String(), nullable=False),
        sa.Column("stripe_reason", sa.String(), nullable=False),
        sa.Column("stripe_receipt_number", sa.String(), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("pledge_id", sa.Uuid(), nullable=True),
        sa.Column(
            "user_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["order_id"], ["orders.id"], name=op.f("refunds_order_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["pledge_id"], ["pledges.id"], name=op.f("refunds_pledge_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("refunds_pkey")),
    )
    op.create_index(
        op.f("ix_refunds_created_at"), "refunds", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_refunds_deleted_at"), "refunds", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_refunds_modified_at"), "refunds", ["modified_at"], unique=False
    )
    op.create_index(op.f("ix_refunds_stripe_id"), "refunds", ["stripe_id"], unique=True)


def upgrade_order_table() -> None:
    op.add_column("orders", sa.Column("status", sa.String(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("refunded_amount", sa.Integer(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("refunded_tax_amount", sa.Integer(), nullable=True),
    )


def backfill_refunds() -> None:
    op.execute(
        """
        INSERT INTO refunds (
            id,
            status,
            reason,
            amount,
            tax_amount,
            currency,
            destination_details,
            stripe_id,
            stripe_reason,
            stripe_receipt_number,
            order_id,
            pledge_id,
            user_metadata,
            created_at,
            modified_at
        )
        SELECT
            gen_random_uuid() AS id,
            'succeeded' AS status,
            -- Safest default. Can populate legacy with Stripe data separately if desired.
            'other' AS reason,
            ABS(r.amount) AS amount,
            ABS(r.tax_amount) AS tax_amount,
            r.currency,

            '{}'::jsonb AS destination_details,
            r.refund_id AS stripe_id,
            -- Safest default. Can populate legacy with Stripe data separately if desired.
            'requested_by_customer' AS stripe_reason,
            NULL AS stripe_receipt_number,

            r.order_id,
            r.pledge_id,
            '{}'::jsonb AS user_metadata,

            r.created_at,
            r.modified_at
        FROM transactions AS r
        WHERE 1 = 1
            AND r.type = 'refund'
            AND r.refund_id IS NOT NULL
            AND r.deleted_at IS NULL
        """
    )


def backfill_orders() -> None:
    op.execute(
        """
        WITH data AS (
            SELECT
                r.order_id,
                SUM(r.amount) AS refunded_amount,
                SUM(r.tax_amount) AS refunded_tax_amount,
                -- Get singular vs. aggregate order amounts in case of multiple refunds
                MAX(orders.amount) AS order_amount,
                MAX(orders.tax_amount) AS order_tax_amount
            FROM refunds AS r
            JOIN orders ON orders.id = r.order_id
            WHERE 1 = 1
                AND r.status = 'succeeded'
                AND r.order_id IS NOT NULL
            GROUP BY 1
        ), order_refunds AS (
            SELECT
                d.*,
                CASE
                    -- Full refunds
                    WHEN (
                        d.refunded_amount = d.order_amount
                        AND d.refunded_tax_amount = d.order_tax_amount
                    ) THEN 'refunded'
                    -- Partial refunds
                    WHEN (
                        d.refunded_amount < d.order_amount
                        OR d.refunded_tax_amount < d.order_tax_amount
                    ) THEN 'partially_refunded'
                    ELSE NULL
                END AS status
            FROM data AS d
        ), updates AS (
            SELECT
                orders.id AS order_id,
                COALESCE(order_refunds.status, 'paid') AS status,
                COALESCE(order_refunds.refunded_amount, 0) AS refunded_amount,
                COALESCE(order_refunds.refunded_tax_amount, 0) AS refunded_tax_amount
            FROM orders
            LEFT JOIN order_refunds ON order_refunds.order_id = orders.id
        )
        UPDATE orders
        SET
            status = updates.status,
            refunded_amount = updates.refunded_amount,
            refunded_tax_amount = updates.refunded_tax_amount
        FROM updates
        WHERE 1 = 1
            AND orders.id = updates.order_id
        """
    )
    op.alter_column("orders", "status", nullable=False)
    op.alter_column("orders", "refunded_amount", nullable=False)
    op.alter_column("orders", "refunded_tax_amount", nullable=False)


###############################################################################
# DOWNGRADE
###############################################################################


def downgrade() -> None:
    drop_refund_table()
    downgrade_order_table()


def drop_refund_table() -> None:
    op.drop_index(op.f("ix_refunds_stripe_id"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_modified_at"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_deleted_at"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_created_at"), table_name="refunds")
    op.drop_table("refunds")


def downgrade_order_table() -> None:
    op.drop_column("orders", "refunded_tax_amount")
    op.drop_column("orders", "refunded_amount")
    op.drop_column("orders", "status")

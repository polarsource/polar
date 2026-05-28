"""Add orders v2 amount columns (int → bigint widening)

Revision ID: 56294184ba8f
Revises: 5579239c38c0
Create Date: 2026-05-28 10:00:00.000000

Phase 1 of widening orders amount columns from integer to bigint via
dual-column migration:

  1. Add nullable *_v2 BIGINT columns for every INT4 amount column.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes
         populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value
         exceeds INT4_MAX (so new code's v2-only writes still populate
         legacy for pods still running the previous version during
         rollout of PR 2).
  3. Backfill existing rows via scripts.backfill_amount_v2_orders.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "56294184ba8f"
down_revision = "5579239c38c0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


ORDERS_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="orders_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.subtotal_amount_v2 IS NULL AND NEW.subtotal_amount IS NOT NULL THEN
                NEW.subtotal_amount_v2 := NEW.subtotal_amount;
            END IF;
            IF NEW.discount_amount_v2 IS NULL AND NEW.discount_amount IS NOT NULL THEN
                NEW.discount_amount_v2 := NEW.discount_amount;
            END IF;
            IF NEW.net_amount_v2 IS NULL AND NEW.net_amount IS NOT NULL THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount_v2 IS NULL AND NEW.tax_amount IS NOT NULL THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.applied_balance_amount_v2 IS NULL AND NEW.applied_balance_amount IS NOT NULL THEN
                NEW.applied_balance_amount_v2 := NEW.applied_balance_amount;
            END IF;
            IF NEW.refunded_amount_v2 IS NULL AND NEW.refunded_amount IS NOT NULL THEN
                NEW.refunded_amount_v2 := NEW.refunded_amount;
            END IF;
            IF NEW.refunded_tax_amount_v2 IS NULL AND NEW.refunded_tax_amount IS NOT NULL THEN
                NEW.refunded_tax_amount_v2 := NEW.refunded_tax_amount;
            END IF;
            IF NEW.platform_fee_amount_v2 IS NULL AND NEW.platform_fee_amount IS NOT NULL THEN
                NEW.platform_fee_amount_v2 := NEW.platform_fee_amount;
            END IF;
            IF NEW.subtotal_amount IS NULL
               AND NEW.subtotal_amount_v2 IS NOT NULL
               AND NEW.subtotal_amount_v2 <= 2147483647 THEN
                NEW.subtotal_amount := NEW.subtotal_amount_v2::integer;
            END IF;
            IF NEW.discount_amount IS NULL
               AND NEW.discount_amount_v2 IS NOT NULL
               AND NEW.discount_amount_v2 <= 2147483647 THEN
                NEW.discount_amount := NEW.discount_amount_v2::integer;
            END IF;
            IF NEW.net_amount IS NULL
               AND NEW.net_amount_v2 IS NOT NULL
               AND NEW.net_amount_v2 <= 2147483647 THEN
                NEW.net_amount := NEW.net_amount_v2::integer;
            END IF;
            IF NEW.tax_amount IS NULL
               AND NEW.tax_amount_v2 IS NOT NULL
               AND NEW.tax_amount_v2 <= 2147483647 THEN
                NEW.tax_amount := NEW.tax_amount_v2::integer;
            END IF;
            IF NEW.applied_balance_amount IS NULL
               AND NEW.applied_balance_amount_v2 IS NOT NULL
               AND NEW.applied_balance_amount_v2 <= 2147483647 THEN
                NEW.applied_balance_amount := NEW.applied_balance_amount_v2::integer;
            END IF;
            IF NEW.refunded_amount IS NULL
               AND NEW.refunded_amount_v2 IS NOT NULL
               AND NEW.refunded_amount_v2 <= 2147483647 THEN
                NEW.refunded_amount := NEW.refunded_amount_v2::integer;
            END IF;
            IF NEW.refunded_tax_amount IS NULL
               AND NEW.refunded_tax_amount_v2 IS NOT NULL
               AND NEW.refunded_tax_amount_v2 <= 2147483647 THEN
                NEW.refunded_tax_amount := NEW.refunded_tax_amount_v2::integer;
            END IF;
            IF NEW.platform_fee_amount IS NULL
               AND NEW.platform_fee_amount_v2 IS NOT NULL
               AND NEW.platform_fee_amount_v2 <= 2147483647 THEN
                NEW.platform_fee_amount := NEW.platform_fee_amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount THEN
                NEW.subtotal_amount_v2 := NEW.subtotal_amount;
            END IF;
            IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
                NEW.discount_amount_v2 := NEW.discount_amount;
            END IF;
            IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.applied_balance_amount IS DISTINCT FROM OLD.applied_balance_amount THEN
                NEW.applied_balance_amount_v2 := NEW.applied_balance_amount;
            END IF;
            IF NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount THEN
                NEW.refunded_amount_v2 := NEW.refunded_amount;
            END IF;
            IF NEW.refunded_tax_amount IS DISTINCT FROM OLD.refunded_tax_amount THEN
                NEW.refunded_tax_amount_v2 := NEW.refunded_tax_amount;
            END IF;
            IF NEW.platform_fee_amount IS DISTINCT FROM OLD.platform_fee_amount THEN
                NEW.platform_fee_amount_v2 := NEW.platform_fee_amount;
            END IF;
            IF NEW.subtotal_amount_v2 IS DISTINCT FROM OLD.subtotal_amount_v2
               AND NEW.subtotal_amount_v2 IS NOT NULL
               AND NEW.subtotal_amount_v2 <= 2147483647 THEN
                NEW.subtotal_amount := NEW.subtotal_amount_v2::integer;
            END IF;
            IF NEW.discount_amount_v2 IS DISTINCT FROM OLD.discount_amount_v2
               AND NEW.discount_amount_v2 IS NOT NULL
               AND NEW.discount_amount_v2 <= 2147483647 THEN
                NEW.discount_amount := NEW.discount_amount_v2::integer;
            END IF;
            IF NEW.net_amount_v2 IS DISTINCT FROM OLD.net_amount_v2
               AND NEW.net_amount_v2 IS NOT NULL
               AND NEW.net_amount_v2 <= 2147483647 THEN
                NEW.net_amount := NEW.net_amount_v2::integer;
            END IF;
            IF NEW.tax_amount_v2 IS DISTINCT FROM OLD.tax_amount_v2
               AND NEW.tax_amount_v2 IS NOT NULL
               AND NEW.tax_amount_v2 <= 2147483647 THEN
                NEW.tax_amount := NEW.tax_amount_v2::integer;
            END IF;
            IF NEW.applied_balance_amount_v2 IS DISTINCT FROM OLD.applied_balance_amount_v2
               AND NEW.applied_balance_amount_v2 IS NOT NULL
               AND NEW.applied_balance_amount_v2 <= 2147483647 THEN
                NEW.applied_balance_amount := NEW.applied_balance_amount_v2::integer;
            END IF;
            IF NEW.refunded_amount_v2 IS DISTINCT FROM OLD.refunded_amount_v2
               AND NEW.refunded_amount_v2 IS NOT NULL
               AND NEW.refunded_amount_v2 <= 2147483647 THEN
                NEW.refunded_amount := NEW.refunded_amount_v2::integer;
            END IF;
            IF NEW.refunded_tax_amount_v2 IS DISTINCT FROM OLD.refunded_tax_amount_v2
               AND NEW.refunded_tax_amount_v2 IS NOT NULL
               AND NEW.refunded_tax_amount_v2 <= 2147483647 THEN
                NEW.refunded_tax_amount := NEW.refunded_tax_amount_v2::integer;
            END IF;
            IF NEW.platform_fee_amount_v2 IS DISTINCT FROM OLD.platform_fee_amount_v2
               AND NEW.platform_fee_amount_v2 IS NOT NULL
               AND NEW.platform_fee_amount_v2 <= 2147483647 THEN
                NEW.platform_fee_amount := NEW.platform_fee_amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


ORDERS_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="orders_sync_v2_amounts_trigger",
    on_entity="public.orders",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON orders\n"
        "    FOR EACH ROW EXECUTE FUNCTION orders_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "orders",
        sa.Column("subtotal_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("discount_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("net_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("tax_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("applied_balance_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("refunded_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("refunded_tax_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("platform_fee_amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(ORDERS_SYNC_V2_AMOUNTS)
    op.create_entity(ORDERS_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(ORDERS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(ORDERS_SYNC_V2_AMOUNTS)
    op.drop_column("orders", "platform_fee_amount_v2")
    op.drop_column("orders", "refunded_tax_amount_v2")
    op.drop_column("orders", "refunded_amount_v2")
    op.drop_column("orders", "applied_balance_amount_v2")
    op.drop_column("orders", "tax_amount_v2")
    op.drop_column("orders", "net_amount_v2")
    op.drop_column("orders", "discount_amount_v2")
    op.drop_column("orders", "subtotal_amount_v2")

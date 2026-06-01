"""Add subscription_product_prices v2 amount columns (int → bigint widening)

Revision ID: 8f2439326360
Revises: 8e527b7e420a
Create Date: 2026-05-29 11:30:00.000000

Phase 1 of widening subscription_product_prices amount columns from integer
to bigint via dual-column migration:

  1. Add nullable *_v2 BIGINT columns for every INT4 amount column.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes
         populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value
         exceeds INT4_MAX (so new code's v2-only writes still populate
         legacy for pods still running the previous version during
         rollout of PR 2).
  3. Backfill existing rows via
     scripts.backfill_amount_v2_subscription_product_prices.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8f2439326360"
down_revision = "8e527b7e420a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="subscription_product_prices_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.amount IS NULL
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.amount_v2 IS DISTINCT FROM OLD.amount_v2
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="subscription_product_prices_sync_v2_amounts_trigger",
    on_entity="public.subscription_product_prices",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON subscription_product_prices\n"
        "    FOR EACH ROW EXECUTE FUNCTION subscription_product_prices_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "subscription_product_prices",
        sa.Column("amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS)
    op.create_entity(SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(SUBSCRIPTION_PRODUCT_PRICES_SYNC_V2_AMOUNTS)
    op.drop_column("subscription_product_prices", "amount_v2")

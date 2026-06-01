"""Add product_prices v2 amount columns (int → bigint widening)

Revision ID: 7ae06f5a0e16
Revises: 7fd113226949
Create Date: 2026-05-29 11:15:00.000000

Phase 1 of widening product_prices amount columns from integer to bigint
via dual-column migration:

  1. Add nullable *_v2 BIGINT columns for every INT4 amount column.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes
         populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value
         exceeds INT4_MAX (so new code's v2-only writes still populate
         legacy for pods still running the previous version during
         rollout of PR 2).
  3. Backfill existing rows via scripts.backfill_amount_v2_product_prices.

The amount columns are polymorphic (single-table inheritance) and already
nullable, so the v2 columns stay nullable too — no NOT NULL tightening in
the cleanup PR.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7ae06f5a0e16"
down_revision = "7fd113226949"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


PRODUCT_PRICES_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="product_prices_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.price_amount_v2 IS NULL AND NEW.price_amount IS NOT NULL THEN
                NEW.price_amount_v2 := NEW.price_amount;
            END IF;
            IF NEW.minimum_amount_v2 IS NULL AND NEW.minimum_amount IS NOT NULL THEN
                NEW.minimum_amount_v2 := NEW.minimum_amount;
            END IF;
            IF NEW.maximum_amount_v2 IS NULL AND NEW.maximum_amount IS NOT NULL THEN
                NEW.maximum_amount_v2 := NEW.maximum_amount;
            END IF;
            IF NEW.preset_amount_v2 IS NULL AND NEW.preset_amount IS NOT NULL THEN
                NEW.preset_amount_v2 := NEW.preset_amount;
            END IF;
            IF NEW.cap_amount_v2 IS NULL AND NEW.cap_amount IS NOT NULL THEN
                NEW.cap_amount_v2 := NEW.cap_amount;
            END IF;
            IF NEW.price_amount IS NULL
               AND NEW.price_amount_v2 IS NOT NULL
               AND NEW.price_amount_v2 <= 2147483647 THEN
                NEW.price_amount := NEW.price_amount_v2::integer;
            END IF;
            IF NEW.minimum_amount IS NULL
               AND NEW.minimum_amount_v2 IS NOT NULL
               AND NEW.minimum_amount_v2 <= 2147483647 THEN
                NEW.minimum_amount := NEW.minimum_amount_v2::integer;
            END IF;
            IF NEW.maximum_amount IS NULL
               AND NEW.maximum_amount_v2 IS NOT NULL
               AND NEW.maximum_amount_v2 <= 2147483647 THEN
                NEW.maximum_amount := NEW.maximum_amount_v2::integer;
            END IF;
            IF NEW.preset_amount IS NULL
               AND NEW.preset_amount_v2 IS NOT NULL
               AND NEW.preset_amount_v2 <= 2147483647 THEN
                NEW.preset_amount := NEW.preset_amount_v2::integer;
            END IF;
            IF NEW.cap_amount IS NULL
               AND NEW.cap_amount_v2 IS NOT NULL
               AND NEW.cap_amount_v2 <= 2147483647 THEN
                NEW.cap_amount := NEW.cap_amount_v2::integer;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.price_amount IS DISTINCT FROM OLD.price_amount THEN
                NEW.price_amount_v2 := NEW.price_amount;
            END IF;
            IF NEW.minimum_amount IS DISTINCT FROM OLD.minimum_amount THEN
                NEW.minimum_amount_v2 := NEW.minimum_amount;
            END IF;
            IF NEW.maximum_amount IS DISTINCT FROM OLD.maximum_amount THEN
                NEW.maximum_amount_v2 := NEW.maximum_amount;
            END IF;
            IF NEW.preset_amount IS DISTINCT FROM OLD.preset_amount THEN
                NEW.preset_amount_v2 := NEW.preset_amount;
            END IF;
            IF NEW.cap_amount IS DISTINCT FROM OLD.cap_amount THEN
                NEW.cap_amount_v2 := NEW.cap_amount;
            END IF;
            IF NEW.price_amount_v2 IS DISTINCT FROM OLD.price_amount_v2
               AND NEW.price_amount_v2 IS NOT NULL
               AND NEW.price_amount_v2 <= 2147483647 THEN
                NEW.price_amount := NEW.price_amount_v2::integer;
            END IF;
            IF NEW.minimum_amount_v2 IS DISTINCT FROM OLD.minimum_amount_v2
               AND NEW.minimum_amount_v2 IS NOT NULL
               AND NEW.minimum_amount_v2 <= 2147483647 THEN
                NEW.minimum_amount := NEW.minimum_amount_v2::integer;
            END IF;
            IF NEW.maximum_amount_v2 IS DISTINCT FROM OLD.maximum_amount_v2
               AND NEW.maximum_amount_v2 IS NOT NULL
               AND NEW.maximum_amount_v2 <= 2147483647 THEN
                NEW.maximum_amount := NEW.maximum_amount_v2::integer;
            END IF;
            IF NEW.preset_amount_v2 IS DISTINCT FROM OLD.preset_amount_v2
               AND NEW.preset_amount_v2 IS NOT NULL
               AND NEW.preset_amount_v2 <= 2147483647 THEN
                NEW.preset_amount := NEW.preset_amount_v2::integer;
            END IF;
            IF NEW.cap_amount_v2 IS DISTINCT FROM OLD.cap_amount_v2
               AND NEW.cap_amount_v2 IS NOT NULL
               AND NEW.cap_amount_v2 <= 2147483647 THEN
                NEW.cap_amount := NEW.cap_amount_v2::integer;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="product_prices_sync_v2_amounts_trigger",
    on_entity="public.product_prices",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON product_prices\n"
        "    FOR EACH ROW EXECUTE FUNCTION product_prices_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "product_prices",
        sa.Column("price_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("minimum_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("maximum_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("preset_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "product_prices",
        sa.Column("cap_amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS)
    op.create_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS)
    op.drop_column("product_prices", "cap_amount_v2")
    op.drop_column("product_prices", "preset_amount_v2")
    op.drop_column("product_prices", "maximum_amount_v2")
    op.drop_column("product_prices", "minimum_amount_v2")
    op.drop_column("product_prices", "price_amount_v2")

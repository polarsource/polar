"""Cleanup product_prices v2 amount columns

Revision ID: 8e527b7e420a
Revises: 7ae06f5a0e16
Create Date: 2026-05-29 15:20:00.000000

Phase 3 of widening product_prices amount columns:

  1. Inline catch-up backfill from legacy → v2 for any environment that
     skipped the standalone backfill script (prod ran it; CI/dev did not).
  2. Drop the bidirectional sync trigger + function.
  3. Drop the five legacy INT4 columns.

The amount columns are polymorphic (single-table inheritance) and stay
nullable, so there is no NOT NULL tightening step.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8e527b7e420a"
down_revision = "7ae06f5a0e16"
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

    op.execute(
        """
        UPDATE product_prices
        SET price_amount_v2 = COALESCE(price_amount_v2, price_amount::bigint),
            minimum_amount_v2 = COALESCE(minimum_amount_v2, minimum_amount::bigint),
            maximum_amount_v2 = COALESCE(maximum_amount_v2, maximum_amount::bigint),
            preset_amount_v2 = COALESCE(preset_amount_v2, preset_amount::bigint),
            cap_amount_v2 = COALESCE(cap_amount_v2, cap_amount::bigint)
        WHERE (price_amount_v2 IS NULL AND price_amount IS NOT NULL)
           OR (minimum_amount_v2 IS NULL AND minimum_amount IS NOT NULL)
           OR (maximum_amount_v2 IS NULL AND maximum_amount IS NOT NULL)
           OR (preset_amount_v2 IS NULL AND preset_amount IS NOT NULL)
           OR (cap_amount_v2 IS NULL AND cap_amount IS NOT NULL)
        """
    )

    op.drop_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS)

    op.drop_column("product_prices", "cap_amount")
    op.drop_column("product_prices", "preset_amount")
    op.drop_column("product_prices", "maximum_amount")
    op.drop_column("product_prices", "minimum_amount")
    op.drop_column("product_prices", "price_amount")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "product_prices", sa.Column("price_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "product_prices", sa.Column("minimum_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "product_prices", sa.Column("maximum_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "product_prices", sa.Column("preset_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "product_prices", sa.Column("cap_amount", sa.Integer(), nullable=True)
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM product_prices
                WHERE price_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR minimum_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR maximum_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR preset_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR cap_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade product_prices amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE product_prices
        SET price_amount = price_amount_v2::integer,
            minimum_amount = minimum_amount_v2::integer,
            maximum_amount = maximum_amount_v2::integer,
            preset_amount = preset_amount_v2::integer,
            cap_amount = cap_amount_v2::integer
        """
    )

    op.create_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS)
    op.create_entity(PRODUCT_PRICES_SYNC_V2_AMOUNTS_TRIGGER)

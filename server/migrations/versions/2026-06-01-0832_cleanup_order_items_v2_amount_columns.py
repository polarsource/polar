"""Cleanup order_items v2 amount columns

Revision ID: 56fdad219161
Revises: 5f832e2ae1da
Create Date: 2026-05-29 14:50:00.000000

Phase 3 of widening order_items amount columns:

  1. Inline catch-up backfill from legacy → v2 for any environment that
     skipped the standalone backfill script (prod ran it; CI/dev did not).
  2. Tighten the v2 columns to NOT NULL via NOT VALID CHECK + VALIDATE
     + ALTER COLUMN, so no rewrite-time ACCESS EXCLUSIVE lock.
  3. Drop the bidirectional sync trigger + function.
  4. Drop the three legacy INT4 columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "56fdad219161"
down_revision = "5f832e2ae1da"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


ORDER_ITEMS_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="order_items_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount_v2 IS NULL AND NEW.net_amount IS NOT NULL THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount_v2 IS NULL AND NEW.tax_amount IS NOT NULL THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.amount IS NULL
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
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
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
                NEW.net_amount_v2 := NEW.net_amount;
            END IF;
            IF NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
                NEW.tax_amount_v2 := NEW.tax_amount;
            END IF;
            IF NEW.amount_v2 IS DISTINCT FROM OLD.amount_v2
               AND NEW.amount_v2 IS NOT NULL
               AND NEW.amount_v2 <= 2147483647 THEN
                NEW.amount := NEW.amount_v2::integer;
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
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


ORDER_ITEMS_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="order_items_sync_v2_amounts_trigger",
    on_entity="public.order_items",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON order_items\n"
        "    FOR EACH ROW EXECUTE FUNCTION order_items_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.execute(
        """
        UPDATE order_items
        SET amount_v2 = COALESCE(amount_v2, amount::bigint),
            net_amount_v2 = COALESCE(net_amount_v2, net_amount::bigint),
            tax_amount_v2 = COALESCE(tax_amount_v2, tax_amount::bigint)
        WHERE (amount_v2 IS NULL AND amount IS NOT NULL)
           OR (net_amount_v2 IS NULL AND net_amount IS NOT NULL)
           OR (tax_amount_v2 IS NULL AND tax_amount IS NOT NULL)
        """
    )

    op.execute(
        """
        ALTER TABLE order_items
            ADD CONSTRAINT order_items_amount_v2_not_null CHECK (amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT order_items_net_amount_v2_not_null CHECK (net_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT order_items_tax_amount_v2_not_null CHECK (tax_amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute(
        "ALTER TABLE order_items VALIDATE CONSTRAINT order_items_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE order_items VALIDATE CONSTRAINT order_items_net_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE order_items VALIDATE CONSTRAINT order_items_tax_amount_v2_not_null"
    )

    op.alter_column(
        "order_items", "amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "order_items", "net_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "order_items", "tax_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )

    op.execute(
        """
        ALTER TABLE order_items
            DROP CONSTRAINT order_items_amount_v2_not_null,
            DROP CONSTRAINT order_items_net_amount_v2_not_null,
            DROP CONSTRAINT order_items_tax_amount_v2_not_null
        """
    )

    op.drop_entity(ORDER_ITEMS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(ORDER_ITEMS_SYNC_V2_AMOUNTS)

    op.drop_column("order_items", "tax_amount")
    op.drop_column("order_items", "net_amount")
    op.drop_column("order_items", "amount")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column("order_items", sa.Column("amount", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("net_amount", sa.Integer(), nullable=True))
    op.add_column("order_items", sa.Column("tax_amount", sa.Integer(), nullable=True))

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM order_items
                WHERE amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR net_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR tax_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade order_items amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE order_items
        SET amount = amount_v2::integer,
            net_amount = net_amount_v2::integer,
            tax_amount = tax_amount_v2::integer
        """
    )

    op.alter_column("order_items", "amount", existing_type=sa.Integer(), nullable=False)
    op.alter_column(
        "order_items", "net_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "order_items", "tax_amount", existing_type=sa.Integer(), nullable=False
    )

    op.alter_column(
        "order_items", "amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "order_items", "net_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "order_items", "tax_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )

    op.create_entity(ORDER_ITEMS_SYNC_V2_AMOUNTS)
    op.create_entity(ORDER_ITEMS_SYNC_V2_AMOUNTS_TRIGGER)

"""Cleanup orders v2 amount columns

Revision ID: 9011bac222d9
Revises: 5758eec95a90
Create Date: 2026-05-28 14:30:00.000000

Phase 3 of widening orders amount columns:

  1. Inline catch-up backfill from legacy → v2 for any environment that
     skipped the standalone backfill script (prod ran it; CI/dev did not).
  2. Tighten the v2 columns to NOT NULL via NOT VALID CHECK + VALIDATE
     + ALTER COLUMN, so no rewrite-time ACCESS EXCLUSIVE lock.
  3. Drop the bidirectional sync trigger + function.
  4. Drop the eight legacy INT4 columns (auto-drops the dependent
     ix_total_amount functional index, which was already dead since PR 2
     remapped queries onto the v2 columns).
  5. Recreate ix_total_amount CONCURRENTLY on the v2 columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9011bac222d9"
down_revision = "5758eec95a90"
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

    op.execute(
        """
        UPDATE orders
        SET subtotal_amount_v2 = COALESCE(subtotal_amount_v2, subtotal_amount::bigint),
            discount_amount_v2 = COALESCE(discount_amount_v2, discount_amount::bigint),
            net_amount_v2 = COALESCE(net_amount_v2, net_amount::bigint),
            tax_amount_v2 = COALESCE(tax_amount_v2, tax_amount::bigint),
            applied_balance_amount_v2 = COALESCE(applied_balance_amount_v2, applied_balance_amount::bigint),
            refunded_amount_v2 = COALESCE(refunded_amount_v2, refunded_amount::bigint),
            refunded_tax_amount_v2 = COALESCE(refunded_tax_amount_v2, refunded_tax_amount::bigint),
            platform_fee_amount_v2 = COALESCE(platform_fee_amount_v2, platform_fee_amount::bigint)
        WHERE (subtotal_amount_v2 IS NULL AND subtotal_amount IS NOT NULL)
           OR (discount_amount_v2 IS NULL AND discount_amount IS NOT NULL)
           OR (net_amount_v2 IS NULL AND net_amount IS NOT NULL)
           OR (tax_amount_v2 IS NULL AND tax_amount IS NOT NULL)
           OR (applied_balance_amount_v2 IS NULL AND applied_balance_amount IS NOT NULL)
           OR (refunded_amount_v2 IS NULL AND refunded_amount IS NOT NULL)
           OR (refunded_tax_amount_v2 IS NULL AND refunded_tax_amount IS NOT NULL)
           OR (platform_fee_amount_v2 IS NULL AND platform_fee_amount IS NOT NULL)
        """
    )

    op.execute(
        """
        ALTER TABLE orders
            ADD CONSTRAINT orders_subtotal_amount_v2_not_null CHECK (subtotal_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_discount_amount_v2_not_null CHECK (discount_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_net_amount_v2_not_null CHECK (net_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_tax_amount_v2_not_null CHECK (tax_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_applied_balance_amount_v2_not_null CHECK (applied_balance_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_refunded_amount_v2_not_null CHECK (refunded_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_refunded_tax_amount_v2_not_null CHECK (refunded_tax_amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT orders_platform_fee_amount_v2_not_null CHECK (platform_fee_amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_subtotal_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_discount_amount_v2_not_null"
    )
    op.execute("ALTER TABLE orders VALIDATE CONSTRAINT orders_net_amount_v2_not_null")
    op.execute("ALTER TABLE orders VALIDATE CONSTRAINT orders_tax_amount_v2_not_null")
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_applied_balance_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_refunded_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_refunded_tax_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE orders VALIDATE CONSTRAINT orders_platform_fee_amount_v2_not_null"
    )

    op.alter_column(
        "orders", "subtotal_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "orders", "discount_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "orders", "net_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "orders", "tax_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "orders",
        "applied_balance_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.alter_column(
        "orders", "refunded_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "orders",
        "refunded_tax_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.alter_column(
        "orders",
        "platform_fee_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=False,
    )

    op.execute(
        """
        ALTER TABLE orders
            DROP CONSTRAINT orders_subtotal_amount_v2_not_null,
            DROP CONSTRAINT orders_discount_amount_v2_not_null,
            DROP CONSTRAINT orders_net_amount_v2_not_null,
            DROP CONSTRAINT orders_tax_amount_v2_not_null,
            DROP CONSTRAINT orders_applied_balance_amount_v2_not_null,
            DROP CONSTRAINT orders_refunded_amount_v2_not_null,
            DROP CONSTRAINT orders_refunded_tax_amount_v2_not_null,
            DROP CONSTRAINT orders_platform_fee_amount_v2_not_null
        """
    )

    op.drop_entity(ORDERS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(ORDERS_SYNC_V2_AMOUNTS)

    op.drop_column("orders", "platform_fee_amount")
    op.drop_column("orders", "refunded_tax_amount")
    op.drop_column("orders", "refunded_amount")
    op.drop_column("orders", "applied_balance_amount")
    op.drop_column("orders", "tax_amount")
    op.drop_column("orders", "net_amount")
    op.drop_column("orders", "discount_amount")
    op.drop_column("orders", "subtotal_amount")

    with op.get_context().autocommit_block():
        op.create_index(
            "ix_total_amount",
            "orders",
            [sa.literal_column("(net_amount_v2 + tax_amount_v2)")],
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    with op.get_context().autocommit_block():
        op.drop_index(
            "ix_total_amount",
            table_name="orders",
            postgresql_concurrently=True,
        )

    op.add_column("orders", sa.Column("subtotal_amount", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("discount_amount", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("net_amount", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("tax_amount", sa.Integer(), nullable=True))
    op.add_column(
        "orders", sa.Column("applied_balance_amount", sa.Integer(), nullable=True)
    )
    op.add_column("orders", sa.Column("refunded_amount", sa.Integer(), nullable=True))
    op.add_column(
        "orders", sa.Column("refunded_tax_amount", sa.Integer(), nullable=True)
    )
    op.add_column(
        "orders", sa.Column("platform_fee_amount", sa.Integer(), nullable=True)
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM orders
                WHERE subtotal_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR discount_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR net_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR tax_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR applied_balance_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR refunded_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR refunded_tax_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR platform_fee_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade orders amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE orders
        SET subtotal_amount = subtotal_amount_v2::integer,
            discount_amount = discount_amount_v2::integer,
            net_amount = net_amount_v2::integer,
            tax_amount = tax_amount_v2::integer,
            applied_balance_amount = applied_balance_amount_v2::integer,
            refunded_amount = refunded_amount_v2::integer,
            refunded_tax_amount = refunded_tax_amount_v2::integer,
            platform_fee_amount = platform_fee_amount_v2::integer
        """
    )

    op.alter_column(
        "orders", "subtotal_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "orders", "discount_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column("orders", "net_amount", existing_type=sa.Integer(), nullable=False)
    op.alter_column("orders", "tax_amount", existing_type=sa.Integer(), nullable=False)
    op.alter_column(
        "orders", "applied_balance_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "orders", "refunded_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "orders", "refunded_tax_amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "orders", "platform_fee_amount", existing_type=sa.Integer(), nullable=False
    )

    op.alter_column(
        "orders", "subtotal_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "orders", "discount_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "orders", "net_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "orders", "tax_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "orders",
        "applied_balance_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.alter_column(
        "orders", "refunded_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "orders",
        "refunded_tax_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.alter_column(
        "orders",
        "platform_fee_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=True,
    )

    op.create_index(
        "ix_total_amount",
        "orders",
        [sa.literal_column("(net_amount + tax_amount)")],
    )

    op.create_entity(ORDERS_SYNC_V2_AMOUNTS)
    op.create_entity(ORDERS_SYNC_V2_AMOUNTS_TRIGGER)

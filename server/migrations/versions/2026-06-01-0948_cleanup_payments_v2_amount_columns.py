"""Cleanup payments v2 amount columns

Revision ID: 7fd113226949
Revises: 59df6fc5b268
Create Date: 2026-05-29 15:05:00.000000

Phase 3 of widening payments amount columns:

  1. Inline catch-up backfill from legacy → v2 for any environment that
     skipped the standalone backfill script (prod ran it; CI/dev did not).
  2. Tighten the v2 columns to NOT NULL via NOT VALID CHECK + VALIDATE
     + ALTER COLUMN, so no rewrite-time ACCESS EXCLUSIVE lock.
  3. Drop the bidirectional sync trigger + function.
  4. Drop the legacy INT4 column.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7fd113226949"
down_revision = "59df6fc5b268"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


PAYMENTS_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="payments_sync_v2_amounts()",
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


PAYMENTS_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="payments_sync_v2_amounts_trigger",
    on_entity="public.payments",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON payments\n"
        "    FOR EACH ROW EXECUTE FUNCTION payments_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.execute(
        """
        UPDATE payments
        SET amount_v2 = COALESCE(amount_v2, amount::bigint)
        WHERE amount_v2 IS NULL AND amount IS NOT NULL
        """
    )

    op.execute(
        """
        ALTER TABLE payments
            ADD CONSTRAINT payments_amount_v2_not_null CHECK (amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute("ALTER TABLE payments VALIDATE CONSTRAINT payments_amount_v2_not_null")

    op.alter_column(
        "payments", "amount_v2", existing_type=sa.BigInteger(), nullable=False
    )

    op.execute("ALTER TABLE payments DROP CONSTRAINT payments_amount_v2_not_null")

    op.drop_entity(PAYMENTS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(PAYMENTS_SYNC_V2_AMOUNTS)

    op.drop_column("payments", "amount")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column("payments", sa.Column("amount", sa.Integer(), nullable=True))

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM payments
                WHERE amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade payments amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE payments
        SET amount = amount_v2::integer
        """
    )

    op.alter_column("payments", "amount", existing_type=sa.Integer(), nullable=False)

    op.alter_column(
        "payments", "amount_v2", existing_type=sa.BigInteger(), nullable=True
    )

    op.create_entity(PAYMENTS_SYNC_V2_AMOUNTS)
    op.create_entity(PAYMENTS_SYNC_V2_AMOUNTS_TRIGGER)

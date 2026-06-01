"""Cleanup subscriptions v2 amount columns

Revision ID: ac74a632960d
Revises: dccf7215745f
Create Date: 2026-05-29 15:45:00.000000

Phase 3 of widening subscriptions amount columns:

  1. Inline catch-up backfill from legacy → v2 for any environment that
     skipped the standalone backfill script (prod ran it; CI/dev did not).
  2. Tighten the v2 columns to NOT NULL via NOT VALID CHECK + VALIDATE
     + ALTER COLUMN, so no rewrite-time ACCESS EXCLUSIVE lock.
  3. Drop the bidirectional sync trigger + function.
  4. Drop the two legacy INT4 columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ac74a632960d"
down_revision = "dccf7215745f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


SUBSCRIPTIONS_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="subscriptions_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount_v2 IS NULL AND NEW.net_amount IS NOT NULL THEN
                NEW.net_amount_v2 := NEW.net_amount;
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
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.net_amount IS DISTINCT FROM OLD.net_amount THEN
                NEW.net_amount_v2 := NEW.net_amount;
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
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


SUBSCRIPTIONS_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="subscriptions_sync_v2_amounts_trigger",
    on_entity="public.subscriptions",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON subscriptions\n"
        "    FOR EACH ROW EXECUTE FUNCTION subscriptions_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.execute(
        """
        UPDATE subscriptions
        SET amount_v2 = COALESCE(amount_v2, amount::bigint),
            net_amount_v2 = COALESCE(net_amount_v2, net_amount::bigint)
        WHERE (amount_v2 IS NULL AND amount IS NOT NULL)
           OR (net_amount_v2 IS NULL AND net_amount IS NOT NULL)
        """
    )

    op.execute(
        """
        ALTER TABLE subscriptions
            ADD CONSTRAINT subscriptions_amount_v2_not_null CHECK (amount_v2 IS NOT NULL) NOT VALID,
            ADD CONSTRAINT subscriptions_net_amount_v2_not_null CHECK (net_amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute(
        "ALTER TABLE subscriptions VALIDATE CONSTRAINT subscriptions_amount_v2_not_null"
    )
    op.execute(
        "ALTER TABLE subscriptions VALIDATE CONSTRAINT subscriptions_net_amount_v2_not_null"
    )

    op.alter_column(
        "subscriptions", "amount_v2", existing_type=sa.BigInteger(), nullable=False
    )
    op.alter_column(
        "subscriptions", "net_amount_v2", existing_type=sa.BigInteger(), nullable=False
    )

    op.execute(
        """
        ALTER TABLE subscriptions
            DROP CONSTRAINT subscriptions_amount_v2_not_null,
            DROP CONSTRAINT subscriptions_net_amount_v2_not_null
        """
    )

    op.drop_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS)

    op.drop_column("subscriptions", "net_amount")
    op.drop_column("subscriptions", "amount")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column("subscriptions", sa.Column("amount", sa.Integer(), nullable=True))
    op.add_column("subscriptions", sa.Column("net_amount", sa.Integer(), nullable=True))

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM subscriptions
                WHERE amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR net_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade subscriptions amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE subscriptions
        SET amount = amount_v2::integer,
            net_amount = net_amount_v2::integer
        """
    )

    op.alter_column(
        "subscriptions", "amount", existing_type=sa.Integer(), nullable=False
    )
    op.alter_column(
        "subscriptions", "net_amount", existing_type=sa.Integer(), nullable=False
    )

    op.alter_column(
        "subscriptions", "amount_v2", existing_type=sa.BigInteger(), nullable=True
    )
    op.alter_column(
        "subscriptions", "net_amount_v2", existing_type=sa.BigInteger(), nullable=True
    )

    op.create_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS)
    op.create_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS_TRIGGER)

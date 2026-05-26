"""Add checkouts v2 amount columns (int → bigint widening)

Revision ID: 1635867d733d
Revises: c89b877bd235
Create Date: 2026-05-26 13:06:00.000000

Phase 1 of widening checkouts.amount, checkouts.net_amount and
checkouts.tax_amount from integer to bigint via dual-column migration:

  1. Add nullable amount_v2 / net_amount_v2 / tax_amount_v2 BIGINT columns.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value exceeds
         INT4_MAX (so new code's v2-only writes still populate legacy for
         pods still running the previous version during rollout of PR 2).
  3. Backfill existing rows via scripts.backfill_amount_v2_checkouts.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1635867d733d"
down_revision = "c89b877bd235"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


CHECKOUTS_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="checkouts_sync_v2_amounts()",
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
            IF NEW.tax_amount_v2 IS DISTINCT FROM OLD.tax_amount_v2 THEN
                IF NEW.tax_amount_v2 IS NULL THEN
                    NEW.tax_amount := NULL;
                ELSIF NEW.tax_amount_v2 <= 2147483647 THEN
                    NEW.tax_amount := NEW.tax_amount_v2::integer;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


CHECKOUTS_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="checkouts_sync_v2_amounts_trigger",
    on_entity="public.checkouts",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON checkouts\n"
        "    FOR EACH ROW EXECUTE FUNCTION checkouts_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "checkouts",
        sa.Column("amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "checkouts",
        sa.Column("net_amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "checkouts",
        sa.Column("tax_amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(CHECKOUTS_SYNC_V2_AMOUNTS)
    op.create_entity(CHECKOUTS_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(CHECKOUTS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(CHECKOUTS_SYNC_V2_AMOUNTS)
    op.drop_column("checkouts", "tax_amount_v2")
    op.drop_column("checkouts", "net_amount_v2")
    op.drop_column("checkouts", "amount_v2")

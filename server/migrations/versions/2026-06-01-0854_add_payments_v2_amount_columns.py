"""Add payments v2 amount columns (int → bigint widening)

Revision ID: 59df6fc5b268
Revises: 56fdad219161
Create Date: 2026-05-29 11:00:00.000000

Phase 1 of widening payments amount columns from integer to bigint via
dual-column migration:

  1. Add nullable *_v2 BIGINT columns for every INT4 amount column.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes
         populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value
         exceeds INT4_MAX (so new code's v2-only writes still populate
         legacy for pods still running the previous version during
         rollout of PR 2).
  3. Backfill existing rows via scripts.backfill_amount_v2_payments.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "59df6fc5b268"
down_revision = "56fdad219161"
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

    op.add_column(
        "payments",
        sa.Column("amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(PAYMENTS_SYNC_V2_AMOUNTS)
    op.create_entity(PAYMENTS_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(PAYMENTS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(PAYMENTS_SYNC_V2_AMOUNTS)
    op.drop_column("payments", "amount_v2")

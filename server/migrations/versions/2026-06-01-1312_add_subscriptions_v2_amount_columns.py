"""Add subscriptions v2 amount columns (int → bigint widening)

Revision ID: dccf7215745f
Revises: 928fd5653fc9
Create Date: 2026-05-29 11:45:00.000000

Phase 1 of widening subscriptions amount columns from integer to bigint via
dual-column migration:

  1. Add nullable *_v2 BIGINT columns for every INT4 amount column.
  2. Install a bidirectional sync trigger:
       - legacy → v2 on every INSERT/UPDATE (so old code's writes
         populate v2).
       - v2 → legacy on every INSERT/UPDATE, skipped when the v2 value
         exceeds INT4_MAX (so new code's v2-only writes still populate
         legacy for pods still running the previous version during
         rollout of PR 2).
  3. Backfill existing rows via scripts.backfill_amount_v2_subscriptions.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "dccf7215745f"
down_revision = "928fd5653fc9"
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

    op.add_column(
        "subscriptions",
        sa.Column("amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("net_amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS)
    op.create_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(SUBSCRIPTIONS_SYNC_V2_AMOUNTS)
    op.drop_column("subscriptions", "net_amount_v2")
    op.drop_column("subscriptions", "amount_v2")

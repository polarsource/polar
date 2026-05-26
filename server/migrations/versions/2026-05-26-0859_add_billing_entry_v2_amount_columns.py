"""Add billing_entry v2 amount columns (int → bigint widening)

Revision ID: 8493a1870f36
Revises: 51b75eff41ad
Create Date: 2026-05-26 08:59:00.000000

Phase 1 of widening billing_entry.amount and billing_entry.discount_amount
from integer to bigint via dual-column migration:

  1. Add nullable amount_v2 / discount_amount_v2 BIGINT columns.
  2. Install a forward-sync trigger that copies amount → amount_v2 and
     discount_amount → discount_amount_v2 on every INSERT/UPDATE.
  3. Backfill existing rows via scripts.backfill_billing_entry_amount_v2.

A follow-up PR remaps the Python attributes to the v2 columns; a final
PR drops the trigger and old columns.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8493a1870f36"
down_revision = "51b75eff41ad"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


BILLING_ENTRY_SYNC_V2_AMOUNTS = PGFunction(
    schema="public",
    signature="billing_entry_sync_v2_amounts()",
    definition="""RETURNS trigger AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.amount_v2 IS NULL AND NEW.amount IS NOT NULL THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.discount_amount_v2 IS NULL AND NEW.discount_amount IS NOT NULL THEN
                NEW.discount_amount_v2 := NEW.discount_amount;
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.amount IS DISTINCT FROM OLD.amount THEN
                NEW.amount_v2 := NEW.amount;
            END IF;
            IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount THEN
                NEW.discount_amount_v2 := NEW.discount_amount;
            END IF;
        END IF;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
)


BILLING_ENTRY_SYNC_V2_AMOUNTS_TRIGGER = PGTrigger(
    schema="public",
    signature="billing_entry_sync_v2_amounts_trigger",
    on_entity="public.billing_entry",
    is_constraint=False,
    definition=(
        "BEFORE INSERT OR UPDATE ON billing_entry\n"
        "    FOR EACH ROW EXECUTE FUNCTION billing_entry_sync_v2_amounts()"
    ),
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column(
        "billing_entry",
        sa.Column("amount_v2", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "billing_entry",
        sa.Column("discount_amount_v2", sa.BigInteger(), nullable=True),
    )

    op.create_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS)
    op.create_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS_TRIGGER)


def downgrade() -> None:
    op.drop_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS)
    op.drop_column("billing_entry", "discount_amount_v2")
    op.drop_column("billing_entry", "amount_v2")

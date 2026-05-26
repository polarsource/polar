"""Drop billing_entry legacy amount columns and sync trigger

Revision ID: dd1a9c1f39c0
Revises: 8493a1870f36
Create Date: 2026-05-26 09:30:00.000000

Phase 3 of widening billing_entry.amount and billing_entry.discount_amount
from integer to bigint:

  1. Drop the forward-sync trigger and function.
  2. Drop the legacy int4 amount and discount_amount columns.

Apply only after the application has been fully running on the v2 columns
(PR 2) long enough that a rollback to the legacy columns is no longer needed.

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "dd1a9c1f39c0"
down_revision = "8493a1870f36"
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

    op.drop_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS)

    op.drop_column("billing_entry", "discount_amount")
    op.drop_column("billing_entry", "amount")


def downgrade() -> None:
    op.add_column(
        "billing_entry",
        sa.Column("amount", sa.Integer(), nullable=True),
    )
    op.add_column(
        "billing_entry",
        sa.Column("discount_amount", sa.Integer(), nullable=True),
    )

    op.create_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS)
    op.create_entity(BILLING_ENTRY_SYNC_V2_AMOUNTS_TRIGGER)

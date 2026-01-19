"""Add redemptions_count column to discounts with triggers

Revision ID: 4b8c9d0e1f2a
Revises: 3af2d42a7578
Create Date: 2026-01-19

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4b8c9d0e1f2a"
down_revision = "3af2d42a7578"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Backfill existing redemption counts
    op.execute(
        """
        UPDATE discounts d
        SET redemptions_count = (
            SELECT COUNT(*)
            FROM discount_redemptions dr
            WHERE dr.discount_id = d.id
        )
        """
    )

    # Create trigger function to increment count on INSERT
    discount_redemptions_count_increment = PGFunction(
        schema="public",
        signature="discount_redemptions_count_increment()",
        definition="""RETURNS trigger AS $$
    BEGIN
        UPDATE discounts
        SET redemptions_count = redemptions_count + 1
        WHERE id = NEW.discount_id;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
    )
    op.create_entity(discount_redemptions_count_increment)

    # Create trigger function to decrement count on DELETE
    discount_redemptions_count_decrement = PGFunction(
        schema="public",
        signature="discount_redemptions_count_decrement()",
        definition="""RETURNS trigger AS $$
    BEGIN
        UPDATE discounts
        SET redemptions_count = redemptions_count - 1
        WHERE id = OLD.discount_id;
        RETURN OLD;
    END
    $$ LANGUAGE plpgsql""",
    )
    op.create_entity(discount_redemptions_count_decrement)

    # Create trigger for INSERT
    discount_redemptions_count_increment_trigger = PGTrigger(
        schema="public",
        signature="discount_redemptions_count_increment_trigger",
        on_entity="public.discount_redemptions",
        is_constraint=False,
        definition="""AFTER INSERT ON discount_redemptions
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_increment()""",
    )
    op.create_entity(discount_redemptions_count_increment_trigger)

    # Create trigger for DELETE
    discount_redemptions_count_decrement_trigger = PGTrigger(
        schema="public",
        signature="discount_redemptions_count_decrement_trigger",
        on_entity="public.discount_redemptions",
        is_constraint=False,
        definition="""AFTER DELETE ON discount_redemptions
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_decrement()""",
    )
    op.create_entity(discount_redemptions_count_decrement_trigger)


def downgrade() -> None:
    # Drop triggers first
    discount_redemptions_count_decrement_trigger = PGTrigger(
        schema="public",
        signature="discount_redemptions_count_decrement_trigger",
        on_entity="public.discount_redemptions",
        is_constraint=False,
        definition="""AFTER DELETE ON discount_redemptions
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_decrement()""",
    )
    op.drop_entity(discount_redemptions_count_decrement_trigger)

    discount_redemptions_count_increment_trigger = PGTrigger(
        schema="public",
        signature="discount_redemptions_count_increment_trigger",
        on_entity="public.discount_redemptions",
        is_constraint=False,
        definition="""AFTER INSERT ON discount_redemptions
    FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_increment()""",
    )
    op.drop_entity(discount_redemptions_count_increment_trigger)

    # Drop functions
    discount_redemptions_count_decrement = PGFunction(
        schema="public",
        signature="discount_redemptions_count_decrement()",
        definition="""RETURNS trigger AS $$
    BEGIN
        UPDATE discounts
        SET redemptions_count = redemptions_count - 1
        WHERE id = OLD.discount_id;
        RETURN OLD;
    END
    $$ LANGUAGE plpgsql""",
    )
    op.drop_entity(discount_redemptions_count_decrement)

    discount_redemptions_count_increment = PGFunction(
        schema="public",
        signature="discount_redemptions_count_increment()",
        definition="""RETURNS trigger AS $$
    BEGIN
        UPDATE discounts
        SET redemptions_count = redemptions_count + 1
        WHERE id = NEW.discount_id;
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql""",
    )
    op.drop_entity(discount_redemptions_count_increment)

    # Drop the column
    op.drop_column("discounts", "redemptions_count")

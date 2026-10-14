"""discount redemptions_count ignores orphaned checkouts

Revision ID: c4e8a1b92d07
Revises: f591dcd9ab42
Create Date: 2026-10-14 08:55:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c4e8a1b92d07"
down_revision = "f591dcd9ab42"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

_COUNTS = """
        dr.subscription_id IS NOT NULL
        OR EXISTS (
            SELECT 1 FROM checkouts c
            WHERE c.id = dr.checkout_id AND c.status = 'confirmed'
        )
        OR EXISTS (
            SELECT 1 FROM orders o
            WHERE (dr.checkout_id IS NOT NULL AND o.checkout_id = dr.checkout_id)
               OR (
                   dr.subscription_id IS NOT NULL
                   AND o.subscription_id = dr.subscription_id
               )
        )
"""


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "DROP TRIGGER IF EXISTS discount_redemptions_count_increment_trigger "
        "ON discount_redemptions"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS discount_redemptions_count_decrement_trigger "
        "ON discount_redemptions"
    )
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_increment()")
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_decrement()")
    op.execute(
        f"""
        CREATE FUNCTION discount_redemptions_count_refresh(target_discount uuid)
        RETURNS void AS $$
        BEGIN
            UPDATE discounts
            SET redemptions_count = (
                SELECT count(*)::integer
                FROM discount_redemptions dr
                WHERE dr.discount_id = target_discount
                  AND ({_COUNTS})
            )
            WHERE id = target_discount;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE FUNCTION discount_redemptions_count_on_redemption()
        RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                PERFORM discount_redemptions_count_refresh(OLD.discount_id);
                RETURN OLD;
            END IF;
            PERFORM discount_redemptions_count_refresh(NEW.discount_id);
            IF TG_OP = 'UPDATE'
               AND OLD.discount_id IS DISTINCT FROM NEW.discount_id THEN
                PERFORM discount_redemptions_count_refresh(OLD.discount_id);
            END IF;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE FUNCTION discount_redemptions_count_on_checkout()
        RETURNS trigger AS $$
        DECLARE
            redemption_discount uuid;
        BEGIN
            IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
                RETURN NEW;
            END IF;
            FOR redemption_discount IN
                SELECT dr.discount_id
                FROM discount_redemptions dr
                WHERE dr.checkout_id = NEW.id
            LOOP
                PERFORM discount_redemptions_count_refresh(redemption_discount);
            END LOOP;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE FUNCTION discount_redemptions_count_on_order()
        RETURNS trigger AS $$
        DECLARE
            redemption_discount uuid;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.checkout_id IS NULL AND NEW.subscription_id IS NULL THEN
                    RETURN NEW;
                END IF;
                FOR redemption_discount IN
                    SELECT DISTINCT dr.discount_id
                    FROM discount_redemptions dr
                    WHERE (
                        NEW.checkout_id IS NOT NULL
                        AND dr.checkout_id = NEW.checkout_id
                    ) OR (
                        NEW.subscription_id IS NOT NULL
                        AND dr.subscription_id = NEW.subscription_id
                    )
                LOOP
                    PERFORM discount_redemptions_count_refresh(redemption_discount);
                END LOOP;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                IF OLD.checkout_id IS NULL AND OLD.subscription_id IS NULL THEN
                    RETURN OLD;
                END IF;
                FOR redemption_discount IN
                    SELECT DISTINCT dr.discount_id
                    FROM discount_redemptions dr
                    WHERE (
                        OLD.checkout_id IS NOT NULL
                        AND dr.checkout_id = OLD.checkout_id
                    ) OR (
                        OLD.subscription_id IS NOT NULL
                        AND dr.subscription_id = OLD.subscription_id
                    )
                LOOP
                    PERFORM discount_redemptions_count_refresh(redemption_discount);
                END LOOP;
                RETURN OLD;
            END IF;
            IF NEW.checkout_id IS NOT DISTINCT FROM OLD.checkout_id
               AND NEW.subscription_id IS NOT DISTINCT FROM OLD.subscription_id THEN
                RETURN NEW;
            END IF;
            FOR redemption_discount IN
                SELECT DISTINCT dr.discount_id
                FROM discount_redemptions dr
                WHERE (
                    OLD.checkout_id IS NOT NULL
                    AND dr.checkout_id = OLD.checkout_id
                ) OR (
                    OLD.subscription_id IS NOT NULL
                    AND dr.subscription_id = OLD.subscription_id
                ) OR (
                    NEW.checkout_id IS NOT NULL
                    AND dr.checkout_id = NEW.checkout_id
                ) OR (
                    NEW.subscription_id IS NOT NULL
                    AND dr.subscription_id = NEW.subscription_id
                )
            LOOP
                PERFORM discount_redemptions_count_refresh(redemption_discount);
            END LOOP;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER discount_redemptions_count_on_redemption_trigger
        AFTER INSERT OR DELETE OR UPDATE OF discount_id, checkout_id, subscription_id
        ON discount_redemptions
        FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_redemption()
        """
    )
    op.execute(
        """
        CREATE TRIGGER discount_redemptions_count_on_checkout_trigger
        AFTER UPDATE OF status ON checkouts
        FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_checkout()
        """
    )
    op.execute(
        """
        CREATE TRIGGER discount_redemptions_count_on_order_trigger
        AFTER INSERT OR DELETE OR UPDATE OF checkout_id, subscription_id
        ON orders
        FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_on_order()
        """
    )
    op.execute(
        f"""
        UPDATE discounts d
        SET redemptions_count = (
            SELECT count(*)::integer
            FROM discount_redemptions dr
            WHERE dr.discount_id = d.id
              AND ({_COUNTS})
        )
        """
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "DROP TRIGGER IF EXISTS discount_redemptions_count_on_order_trigger ON orders"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS discount_redemptions_count_on_checkout_trigger "
        "ON checkouts"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS discount_redemptions_count_on_redemption_trigger "
        "ON discount_redemptions"
    )
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_on_order()")
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_on_checkout()")
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_on_redemption()")
    op.execute("DROP FUNCTION IF EXISTS discount_redemptions_count_refresh(uuid)")
    op.execute(
        """
        CREATE FUNCTION discount_redemptions_count_increment()
        RETURNS trigger AS $$
        BEGIN
            UPDATE discounts
            SET redemptions_count = redemptions_count + 1
            WHERE id = NEW.discount_id;
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE FUNCTION discount_redemptions_count_decrement()
        RETURNS trigger AS $$
        BEGIN
            UPDATE discounts
            SET redemptions_count = redemptions_count - 1
            WHERE id = OLD.discount_id;
            RETURN OLD;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER discount_redemptions_count_increment_trigger
        AFTER INSERT ON discount_redemptions
        FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_increment()
        """
    )
    op.execute(
        """
        CREATE TRIGGER discount_redemptions_count_decrement_trigger
        AFTER DELETE ON discount_redemptions
        FOR EACH ROW EXECUTE FUNCTION discount_redemptions_count_decrement()
        """
    )
    op.execute(
        """
        UPDATE discounts d
        SET redemptions_count = (
            SELECT count(*)::integer
            FROM discount_redemptions dr
            WHERE dr.discount_id = d.id
        )
        """
    )

"""Cleanup checkouts v2 amount columns

Revision ID: 8f4d6b9a2c31
Revises: f2d8090bf7c2
Create Date: 2026-05-26 21:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8f4d6b9a2c31"
down_revision = "f2d8090bf7c2"
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

    op.execute(
        """
        ALTER TABLE checkouts
        ADD CONSTRAINT checkouts_amount_v2_not_null
        CHECK (amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE checkouts
        ADD CONSTRAINT checkouts_net_amount_v2_not_null
        CHECK (net_amount_v2 IS NOT NULL) NOT VALID
        """
    )
    op.execute("ALTER TABLE checkouts VALIDATE CONSTRAINT checkouts_amount_v2_not_null")
    op.execute(
        "ALTER TABLE checkouts VALIDATE CONSTRAINT checkouts_net_amount_v2_not_null"
    )
    op.alter_column(
        "checkouts",
        "amount_v2",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.alter_column(
        "checkouts",
        "net_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=False,
    )
    op.drop_constraint("checkouts_amount_v2_not_null", "checkouts", type_="check")
    op.drop_constraint("checkouts_net_amount_v2_not_null", "checkouts", type_="check")

    op.drop_entity(CHECKOUTS_SYNC_V2_AMOUNTS_TRIGGER)
    op.drop_entity(CHECKOUTS_SYNC_V2_AMOUNTS)
    op.drop_column("checkouts", "tax_amount")
    op.drop_column("checkouts", "net_amount")
    op.drop_column("checkouts", "amount")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")

    op.add_column("checkouts", sa.Column("amount", sa.Integer(), nullable=True))
    op.add_column("checkouts", sa.Column("net_amount", sa.Integer(), nullable=True))
    op.add_column("checkouts", sa.Column("tax_amount", sa.Integer(), nullable=True))

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM checkouts
                WHERE amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR net_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
                   OR tax_amount_v2 NOT BETWEEN -2147483648 AND 2147483647
            ) THEN
                RAISE EXCEPTION 'Cannot downgrade checkouts amount columns with values outside int4 range';
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET amount = amount_v2::integer,
            net_amount = net_amount_v2::integer,
            tax_amount = tax_amount_v2::integer
        """
    )
    op.alter_column(
        "checkouts",
        "amount",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "checkouts",
        "net_amount",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "checkouts",
        "amount_v2",
        existing_type=sa.BigInteger(),
        nullable=True,
    )
    op.alter_column(
        "checkouts",
        "net_amount_v2",
        existing_type=sa.BigInteger(),
        nullable=True,
    )

    op.create_entity(CHECKOUTS_SYNC_V2_AMOUNTS)
    op.create_entity(CHECKOUTS_SYNC_V2_AMOUNTS_TRIGGER)

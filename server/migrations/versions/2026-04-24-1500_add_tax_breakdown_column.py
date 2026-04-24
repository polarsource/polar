"""add tax_breakdown column to orders, checkouts and wallet_transactions

Revision ID: f3a2b1c4d5e6
Revises: ead15547bea8
Create Date: 2026-04-24 15:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3a2b1c4d5e6"
down_revision = "ead15547bea8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )
    op.add_column(
        "checkouts",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )
    op.add_column(
        "wallet_transactions",
        sa.Column(
            "tax_breakdown",
            postgresql.JSONB(astext_type=sa.Text(), none_as_null=True),
            nullable=True,
        ),
    )

    # Backfill existing orders: create a single-item tax_breakdown from tax_rate,
    # taxability_reason, and tax_amount
    op.execute(
        """
        UPDATE orders
        SET tax_breakdown = jsonb_build_array(
            jsonb_build_object(
                'rate_type', tax_rate->>'rate_type',
                'basis_points', (tax_rate->>'basis_points')::int,
                'display_name', tax_rate->>'display_name',
                'country', tax_rate->>'country',
                'state', tax_rate->>'state',
                'amount', tax_amount,
                'taxability_reason', taxability_reason
            )
        )
        WHERE tax_rate IS NOT NULL
          AND taxability_reason IS NOT NULL
          AND tax_amount > 0
        """
    )

    # Backfill existing checkouts
    op.execute(
        """
        UPDATE checkouts
        SET tax_breakdown = jsonb_build_array(
            jsonb_build_object(
                'rate_type', tax_rate->>'rate_type',
                'basis_points', (tax_rate->>'basis_points')::int,
                'display_name', tax_rate->>'display_name',
                'country', tax_rate->>'country',
                'state', tax_rate->>'state',
                'amount', tax_amount,
                'taxability_reason', taxability_reason
            )
        )
        WHERE tax_rate IS NOT NULL
          AND taxability_reason IS NOT NULL
          AND tax_amount > 0
        """
    )

    # Backfill existing wallet_transactions
    op.execute(
        """
        UPDATE wallet_transactions
        SET tax_breakdown = jsonb_build_array(
            jsonb_build_object(
                'rate_type', tax_rate->>'rate_type',
                'basis_points', (tax_rate->>'basis_points')::int,
                'display_name', tax_rate->>'display_name',
                'country', tax_rate->>'country',
                'state', tax_rate->>'state',
                'amount', tax_amount,
                'taxability_reason', taxability_reason
            )
        )
        WHERE tax_rate IS NOT NULL
          AND taxability_reason IS NOT NULL
          AND tax_amount > 0
        """
    )


def downgrade() -> None:
    op.drop_column("wallet_transactions", "tax_breakdown")
    op.drop_column("checkouts", "tax_breakdown")
    op.drop_column("orders", "tax_breakdown")

"""Add customer portal settings

Revision ID: 916e176efd47
Revises: 27c616f714dd
Create Date: 2025-12-18 21:56:21.026737

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "916e176efd47"
down_revision = "27c616f714dd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "customer_portal_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    # Copy existing subscriptions_settings.allow_customer_updates
    # Keep it though for now. Settle with code migration first.
    # Then nuke the legacy attribute on subscription_settings (backup + safety)
    op.execute("""
        UPDATE organizations
        SET customer_portal_settings = jsonb_build_object(
            'usage', jsonb_build_object('show', true),
            'subscription', jsonb_build_object(
                'update_seats', true,
                'update_plan', false
            )
        )
        WHERE subscription_settings->>'allow_customer_updates' = 'false'
    """)

    # Set default for everything else
    op.execute("""
        UPDATE organizations
        SET customer_portal_settings = jsonb_build_object(
            'usage', jsonb_build_object('show', true),
            'subscription', jsonb_build_object(
                'update_seats', true,
                'update_plan', true
            )
        )
        WHERE customer_portal_settings = '{}'::jsonb
    """)


def downgrade() -> None:
    op.drop_column("organizations", "customer_portal_settings")

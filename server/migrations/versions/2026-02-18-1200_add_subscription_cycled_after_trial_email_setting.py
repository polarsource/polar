"""Add subscription_cycled_after_trial to customer_email_settings

Revision ID: c8f2a1b3d456
Revises: a1c2d3e4f567
Create Date: 2026-02-18 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c8f2a1b3d456"
down_revision = "a1c2d3e4f567"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Set subscription_cycled_after_trial to match subscription_cycled
    # so organizations that opted out of the renewal email don't suddenly
    # start receiving the new trial conversion email.
    op.execute(
        """
        UPDATE organizations
        SET customer_email_settings = customer_email_settings || jsonb_build_object(
            'subscription_cycled_after_trial',
            COALESCE(customer_email_settings->'subscription_cycled', 'true'::jsonb)
        )
        WHERE NOT (customer_email_settings ? 'subscription_cycled_after_trial')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET customer_email_settings = customer_email_settings - 'subscription_cycled_after_trial'
        """
    )

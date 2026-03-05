"""Add reminder email settings to organizations

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-03-02 12:01:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET customer_email_settings = customer_email_settings
            || '{"subscription_renewal_reminder": true, "subscription_trial_conversion_reminder": true}'::jsonb
        WHERE customer_email_settings IS NOT NULL
    """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET customer_email_settings = customer_email_settings
            - 'subscription_renewal_reminder'
            - 'subscription_trial_conversion_reminder'
        WHERE customer_email_settings IS NOT NULL
    """
    )

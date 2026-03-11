"""Add subscription reminder email settings

Revision ID: 9b73bce01fd4
Revises: 5763a8e49485
Create Date: 2026-03-10 12:00:00.000000

"""

from alembic import op
from sqlalchemy import text as sql_text

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9b73bce01fd4"
down_revision = "5763a8e49485"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add subscription_renewal_reminder and subscription_trial_conversion_reminder
    # to existing organizations' customer_email_settings JSONB column, defaulting to true.
    op.execute(
        sql_text(
            """
            UPDATE organizations
            SET customer_email_settings = customer_email_settings
                || '{"subscription_renewal_reminder": true, "subscription_trial_conversion_reminder": true}'::jsonb
            WHERE customer_email_settings IS NOT NULL
              AND NOT (customer_email_settings ? 'subscription_renewal_reminder')
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sql_text(
            """
            UPDATE organizations
            SET customer_email_settings = customer_email_settings
                - 'subscription_renewal_reminder'
                - 'subscription_trial_conversion_reminder'
            WHERE customer_email_settings IS NOT NULL
            """
        )
    )

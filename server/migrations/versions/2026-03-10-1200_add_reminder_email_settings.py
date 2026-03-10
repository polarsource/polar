"""Add reminder email settings to organizations

Revision ID: c8d9e0f1a2b3
Revises: a1fd4341cf14
Create Date: 2026-03-10 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c8d9e0f1a2b3"
down_revision = "a1fd4341cf14"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add subscription_renewal_reminder and subscription_trial_conversion_reminder
    # to existing organizations' customer_email_settings JSONB, defaulting to true
    op.execute(
        sa.text(
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
        sa.text(
            """
            UPDATE organizations
            SET customer_email_settings = customer_email_settings
                - 'subscription_renewal_reminder'
                - 'subscription_trial_conversion_reminder'
            WHERE customer_email_settings IS NOT NULL
            """
        )
    )

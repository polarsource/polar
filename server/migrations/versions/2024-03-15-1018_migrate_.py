"""Migrate MaintainerNewPaidSubscriptionNotification payloads

Revision ID: 281fb5f68451
Revises: 2422ee81b025
Create Date: 2024-03-15 10:18:53.983198

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "281fb5f68451"
down_revision = "2422ee81b025"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add `tier_price_recurring_interval` property in the JSONB column value of `notifications` table if not already present
    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{tier_price_recurring_interval}',
            to_jsonb('month'::text),
            true
        )
        WHERE type = 'MaintainerNewPaidSubscriptionNotification'
        AND NOT payload ? 'tier_price_recurring_interval'
        """
    )


def downgrade() -> None:
    # Remove `tier_price_recurring_interval` property from the JSONB column value of `notifications` table
    op.execute(
        """
        UPDATE notifications
        SET payload = payload - 'tier_price_recurring_interval'
        WHERE type = 'MaintainerNewPaidSubscriptionNotification'
        """
    )

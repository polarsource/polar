"""Add subscription_canceled to notification_settings

Revision ID: 7c4e9f1a2b3d
Revises: 8a3f5b2c1d9e
Create Date: 2026-02-27 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c4e9f1a2b3d"
down_revision = "8a3f5b2c1d9e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET notification_settings = notification_settings || '{"subscription_canceled": false}'
        WHERE NOT (notification_settings ? 'subscription_canceled')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET notification_settings = notification_settings - 'subscription_canceled'
        """
    )

"""Migrate SubscriptionTierType

Revision ID: ce178fc3ee8e
Revises: 9006f0c3bea2
Create Date: 2024-01-04 10:29:17.861729

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "ce178fc3ee8e"
down_revision = "9006f0c3bea2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE subscription_tiers
        SET type = 'individual'
        WHERE type = 'hobby'
    """
    )
    op.execute(
        """
        UPDATE subscription_tiers
        SET type = 'business'
        WHERE type = 'pro'
    """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE subscription_tiers
        SET type = 'hobby'
        WHERE type = 'individual'
    """
    )

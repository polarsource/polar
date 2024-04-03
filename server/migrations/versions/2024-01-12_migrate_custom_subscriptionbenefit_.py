"""Migrate custom SubscriptionBenefit properties

Revision ID: c50e859a75d8
Revises: 28aa8bed1eeb
Create Date: 2024-01-12 09:41:34.113588

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "c50e859a75d8"
down_revision = "28aa8bed1eeb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE subscription_benefits SET properties = '{"note": null}' WHERE type = 'custom';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE subscription_benefits SET properties = '{}' WHERE type = 'custom';
        """
    )

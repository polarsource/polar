"""Rename SubscriptionBenefitPreconditionErrorNotification to BenefitPreconditionErrorNotification

Revision ID: cf1e8a6ee407
Revises: 1c75c9f84cf1
Create Date: 2024-04-15 11:26:01.651180

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "cf1e8a6ee407"
down_revision = "1c75c9f84cf1"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE notifications
        SET type = 'BenefitPreconditionErrorNotification'
        WHERE type = 'SubscriptionBenefitPreconditionErrorNotification'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE notifications
        SET type = 'SubscriptionBenefitPreconditionErrorNotification'
        WHERE type = 'BenefitPreconditionErrorNotification'
        """
    )

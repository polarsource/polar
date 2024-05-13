"""Fix Account.status given Stripe flags

Revision ID: 5b96b5f08ddc
Revises: f964f4d62814
Create Date: 2024-05-13 09:10:15.468785

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "5b96b5f08ddc"
down_revision = "f964f4d62814"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE accounts
        SET status = 'onboarding_started'
        WHERE account_type = 'stripe'
        AND status = 'active'
        AND (
            is_details_submitted IS FALSE
            OR is_charges_enabled IS FALSE
            OR is_payouts_enabled IS FALSE
        )
        """
    )


def downgrade() -> None:
    pass

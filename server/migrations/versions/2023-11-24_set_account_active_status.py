"""Set Account active status

Revision ID: 71ee19001e23
Revises: 807215e5e590
Create Date: 2023-11-24 13:54:10.345598

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "71ee19001e23"
down_revision = "807215e5e590"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE accounts
        SET status = 'active'
        WHERE account_type = 'open_collective'
        """
    )

    op.execute(
        """
        UPDATE accounts
        SET status = 'active'
        WHERE account_type = 'stripe'
        AND currency IS NOT NULL
        AND is_details_submitted = TRUE
        AND is_charges_enabled = TRUE
        AND is_payouts_enabled = TRUE
        """
    )


def downgrade() -> None:
    pass

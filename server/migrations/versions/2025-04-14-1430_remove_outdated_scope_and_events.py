"""Remove outdated scope and events

Revision ID: 5496aa5b12ad
Revises: 8250613a3fdd
Create Date: 2025-04-14 14:30:35.961142

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5496aa5b12ad"
down_revision = "8250613a3fdd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE webhook_endpoints
        SET events = events - 'pledge.created'
        """
    )
    op.execute(
        """
        UPDATE webhook_endpoints
        SET events = events - 'pledge.updated'
        """
    )


def downgrade() -> None:
    pass

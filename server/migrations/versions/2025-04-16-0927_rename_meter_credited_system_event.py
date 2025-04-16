"""Rename meter_credited system event

Revision ID: 7a95c37b2a26
Revises: 871bf4f37db0
Create Date: 2025-04-16 09:27:56.175251

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7a95c37b2a26"
down_revision = "871bf4f37db0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE events
        SET name = 'meter.credited'
        WHERE name = 'meter_credited'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE events
        SET name = 'meter_credited'
        WHERE name = 'meter.credited'
        """
    )

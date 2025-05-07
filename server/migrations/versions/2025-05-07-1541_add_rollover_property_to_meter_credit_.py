"""Add rollover property to meter credit benefit

Revision ID: bbe98883e4bd
Revises: fe68dfd0eac2
Create Date: 2025-05-07 15:41:51.547332

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "bbe98883e4bd"
down_revision = "fe68dfd0eac2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE benefits
        SET properties = jsonb_set(properties, '{rollover}', 'true')
        WHERE type = 'meter_credit'
        """
    )
    op.execute(
        """
        UPDATE events
        SET user_metadata = jsonb_set(user_metadata, '{rollover}', 'true')
        WHERE source = 'system' AND name = 'meter.credited'
        """
    )


def downgrade() -> None:
    pass

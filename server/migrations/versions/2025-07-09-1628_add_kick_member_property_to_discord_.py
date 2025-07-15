"""Add kick_member property to Discord benefit properties

Revision ID: 31fc877afc52
Revises: 4b8976c08210
Create Date: 2025-07-09 16:28:43.075061

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "31fc877afc52"
down_revision = "4b8976c08210"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE benefits
        SET properties = jsonb_set(
            properties,
            '{kick_member}',
            'false'
        )
        WHERE type = 'discord'
        """
    )


def downgrade() -> None:
    pass

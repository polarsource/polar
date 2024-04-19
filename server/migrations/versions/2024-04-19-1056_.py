"""empty message

Revision ID: 1121c6536d71
Revises: 59b002a11fe8
Create Date: 2024-04-19 10:56:03.540853

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "1121c6536d71"
down_revision = "59b002a11fe8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""empty message

Revision ID: 92ad9cd0af03
Revises: e5582752aa8a, e7ae35380611
Create Date: 2024-05-06 10:39:09.576767

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "92ad9cd0af03"
down_revision = ("e5582752aa8a", "e7ae35380611")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

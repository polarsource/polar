"""empty message

Revision ID: bab063af0113
Revises: 22b6469a1294, 05980c33b79a
Create Date: 2024-05-15 10:37:52.789209

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "bab063af0113"
down_revision = ("22b6469a1294", "05980c33b79a")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

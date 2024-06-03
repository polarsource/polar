"""empty message

Revision ID: ffef54e76cc7
Revises: cf1a0b3f309c, 519ac2a1709e
Create Date: 2024-06-03 13:41:20.173497

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "ffef54e76cc7"
down_revision = ("cf1a0b3f309c", "519ac2a1709e")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

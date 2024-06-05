"""empty message

Revision ID: 59fc69639586
Revises: 8d7f2462df15, ffef54e76cc7
Create Date: 2024-06-05 09:51:09.229215

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "59fc69639586"
down_revision = ("8d7f2462df15", "ffef54e76cc7")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

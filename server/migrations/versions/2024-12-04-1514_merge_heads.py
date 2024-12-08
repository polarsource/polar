"""Merge heads

Revision ID: e24ba8ac9c6c
Revises: 39ce508b936c, db639a5f23f3
Create Date: 2024-12-04 15:14:58.360579

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e24ba8ac9c6c"
down_revision = ("39ce508b936c", "db639a5f23f3")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

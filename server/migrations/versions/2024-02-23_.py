"""empty message

Revision ID: e5e68362e04a
Revises: 1ce8e8379bd1, 52635db50fbb
Create Date: 2024-02-23 09:29:23.707807

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "e5e68362e04a"
down_revision = ("1ce8e8379bd1", "52635db50fbb")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""empty message

Revision ID: 7a14bdaa6ed8
Revises: 8f8b4ff1caea, 1969756c9810
Create Date: 2023-10-25 16:06:27.140017

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "7a14bdaa6ed8"
down_revision = ("8f8b4ff1caea", "1969756c9810")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

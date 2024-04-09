"""empty message

Revision ID: 9fae4998c18f
Revises: 9396f8792e97, 2c69523599fe
Create Date: 2024-04-09 13:22:44.521389

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "9fae4998c18f"
down_revision = ("9396f8792e97", "2c69523599fe")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

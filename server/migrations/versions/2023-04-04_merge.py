"""empty message

Revision ID: 6919bbcc4abd
Revises: e833ad7e1285, 23d7954e9cbe
Create Date: 2023-04-04 11:18:17.718314

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "6919bbcc4abd"
down_revision = ("e833ad7e1285", "23d7954e9cbe")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

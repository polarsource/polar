"""empty message

Revision ID: 8d213a6d9251
Revises: 06ac1d084d1b, ea83384b81c7
Create Date: 2023-09-14 11:32:13.827283

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "8d213a6d9251"
down_revision = ("06ac1d084d1b", "ea83384b81c7")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""empty message

Revision ID: 6b258706fdb7
Revises: 37f3b1b1a590, cc3752dd3b05
Create Date: 2024-03-08 10:59:02.929969

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "6b258706fdb7"
down_revision = ("37f3b1b1a590", "cc3752dd3b05")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""Merge 5260355de70c and bd951c7c4d8f

Revision ID: 31c7296cf0f7
Revises: 5260355de70c, bd951c7c4d8f
Create Date: 2023-04-27 14:11:22.070823

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = '31c7296cf0f7'
down_revision = ('5260355de70c', 'bd951c7c4d8f')
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

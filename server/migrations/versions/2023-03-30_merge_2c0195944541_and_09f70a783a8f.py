"""Merge 2c0195944541 and 09f70a783a8f

Revision ID: caed9ddeab44
Revises: 2c0195944541, 09f70a783a8f
Create Date: 2023-03-30 11:48:58.255320

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = 'caed9ddeab44'
down_revision = ('2c0195944541', '09f70a783a8f')
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

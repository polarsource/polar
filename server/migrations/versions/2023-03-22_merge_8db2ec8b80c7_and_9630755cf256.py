"""Merge 8db2ec8b80c7 and 9630755cf256

Revision ID: 125627402691
Revises: 8db2ec8b80c7, 9630755cf256
Create Date: 2023-03-22 14:01:13.650522

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = '125627402691'
down_revision = ('8db2ec8b80c7', '9630755cf256')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

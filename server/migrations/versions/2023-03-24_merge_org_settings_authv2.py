"""merge org_settings + authv2

Revision ID: d057eadc5617
Revises: bb55a4765569, 8172110c0b6b
Create Date: 2023-03-24 21:50:46.520549

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = 'd057eadc5617'
down_revision = ('bb55a4765569', '8172110c0b6b')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

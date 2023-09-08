"""empty message

Revision ID: c26ca9e26647
Revises: 6748b343a12d, 81d21642cefb
Create Date: 2023-09-08 14:45:03.739925

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = 'c26ca9e26647'
down_revision = ('6748b343a12d', '81d21642cefb')
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

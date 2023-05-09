"""empty message

Revision ID: 77467f8f6202
Revises: 5207759b2660, 366887033e1c
Create Date: 2023-05-09 10:17:58.056360

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = '77467f8f6202'
down_revision = ('5207759b2660', '366887033e1c')
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

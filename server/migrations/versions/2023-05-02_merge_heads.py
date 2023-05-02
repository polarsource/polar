"""empty message

Revision ID: 1170fc9f1510
Revises: 5557793e5b55, d1c4f71efc51
Create Date: 2023-05-02 14:54:51.991848

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = '1170fc9f1510'
down_revision = ('5557793e5b55', 'd1c4f71efc51')
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

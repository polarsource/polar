"""empty message

Revision ID: 65aaa49b6c56
Revises: 9c60487b49ab, 59b002a11fe8
Create Date: 2024-04-19 11:08:04.077924

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "65aaa49b6c56"
down_revision = ("9c60487b49ab", "59b002a11fe8")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

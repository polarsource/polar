"""empty message

Revision ID: c0178cca1e34
Revises: eb594db004e3, 8edbdb5e9079
Create Date: 2024-03-25 15:48:16.009782

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "c0178cca1e34"
down_revision = ("eb594db004e3", "8edbdb5e9079")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

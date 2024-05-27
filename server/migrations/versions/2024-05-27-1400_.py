"""empty message

Revision ID: cf1a0b3f309c
Revises: a630b7020ff2, de1c70f1c536
Create Date: 2024-05-27 14:00:02.778646

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "cf1a0b3f309c"
down_revision = ("a630b7020ff2", "de1c70f1c536")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

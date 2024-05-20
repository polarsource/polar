"""empty message

Revision ID: 8a5bd98b177f
Revises: 9961ac3d4071, f850759b02d5
Create Date: 2024-05-20 13:55:15.889999

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "8a5bd98b177f"
down_revision = ("9961ac3d4071", "f850759b02d5")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

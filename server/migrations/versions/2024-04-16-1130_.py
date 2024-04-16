"""empty message

Revision ID: 01ed0cee6494
Revises: c9f9c83bfa81, adc10ed5aa33
Create Date: 2024-04-16 11:30:58.480291

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "01ed0cee6494"
down_revision = ("c9f9c83bfa81", "adc10ed5aa33")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

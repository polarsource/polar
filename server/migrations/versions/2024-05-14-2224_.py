"""empty message

Revision ID: 05980c33b79a
Revises: 7192dd2c7d7e, 5b96b5f08ddc
Create Date: 2024-05-14 22:24:44.712457

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "05980c33b79a"
down_revision = ("7192dd2c7d7e", "5b96b5f08ddc")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

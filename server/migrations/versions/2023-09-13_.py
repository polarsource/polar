"""empty message

Revision ID: acf4ea846f4d
Revises: 7ace57bba3b7, d47500275943
Create Date: 2023-09-13 16:16:48.804037

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "acf4ea846f4d"
down_revision = ("7ace57bba3b7", "d47500275943")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

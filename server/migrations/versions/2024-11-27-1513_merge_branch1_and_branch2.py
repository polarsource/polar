"""Merge branch1 and branch2

Revision ID: b2f724d41a21
Revises: c3bb97b6951d, 1769a6e618a4
Create Date: 2024-11-27 15:13:47.122110

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b2f724d41a21"
down_revision = ("c3bb97b6951d", "1769a6e618a4")
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

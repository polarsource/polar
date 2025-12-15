"""enable_timescaledb

Revision ID: b3887f09f522
Revises: cda30394fab9
Create Date: 2025-12-15 10:59:37.734949

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b3887f09f522"
down_revision = "cda30394fab9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS timescaledb CASCADE")

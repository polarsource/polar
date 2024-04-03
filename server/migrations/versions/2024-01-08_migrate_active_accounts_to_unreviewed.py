"""Migrate ACTIVE accounts to UNREVIEWED

Revision ID: e82ceb168ce8
Revises: 81a9b494f9d5
Create Date: 2024-01-08 09:39:59.275884

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "e82ceb168ce8"
down_revision = "81a9b494f9d5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE accounts SET status = 'unreviewed' WHERE status = 'active'")


def downgrade() -> None:
    op.execute("UPDATE accounts SET status = 'active' WHERE status = 'unreviewed'")

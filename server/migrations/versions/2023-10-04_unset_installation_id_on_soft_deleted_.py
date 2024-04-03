"""Unset installation_id on soft-deleted organizations

Revision ID: 754943765066
Revises: a5c4237d7afb
Create Date: 2023-10-04 09:02:14.581947

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "754943765066"
down_revision = "a5c4237d7afb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE organizations "
        "SET installation_id = NULL "
        "WHERE organizations.deleted_at IS NOT NULL"
    )


def downgrade() -> None:
    pass

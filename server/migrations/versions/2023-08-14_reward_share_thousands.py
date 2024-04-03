"""reward.share_thousands

Revision ID: 1bd979055f40
Revises: 0e7ae9127aeb
Create Date: 2023-08-14 15:51:27.949816

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "1bd979055f40"
down_revision = "0e7ae9127aeb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column("issue_rewards", "share", new_column_name="share_thousands")
    op.execute("UPDATE issue_rewards SET share_thousands = share_thousands * 1000")


def downgrade() -> None:
    op.alter_column("issue_rewards", "share_thousands", new_column_name="share")
    op.execute("UPDATE issue_rewards SET share_thousands = share_thousands / 1000")

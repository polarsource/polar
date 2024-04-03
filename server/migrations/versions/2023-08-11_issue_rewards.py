"""issue_rewards

Revision ID: 720f07435609
Revises: 449476826250
Create Date: 2023-08-11 15:15:34.503925

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "720f07435609"
down_revision = "449476826250"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.rename_table("pledge_splits", "issue_rewards")

    op.alter_column(
        "pledge_transactions", "pledge_split_id", new_column_name="issue_reward_id"
    )


def downgrade() -> None:
    op.rename_table("issue_rewards", "pledge_splits")

    op.alter_column(
        "pledge_transactions", "issue_reward_id", new_column_name="pledge_split_id"
    )

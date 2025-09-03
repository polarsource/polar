"""Reset Subscription.scheduler_locked

Revision ID: 4b946a507b1e
Revises: d15c9bf2d716
Create Date: 2025-09-03 16:01:18.612931

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4b946a507b1e"
down_revision = "d15c9bf2d716"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE subscriptions SET scheduler_locked = FALSE WHERE scheduler_locked = TRUE;"
    )


def downgrade() -> None:
    pass

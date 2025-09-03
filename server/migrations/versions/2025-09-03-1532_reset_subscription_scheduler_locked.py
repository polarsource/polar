"""Reset Subscription.scheduler_locked

Revision ID: d15c9bf2d716
Revises: c898ba0e8e77
Create Date: 2025-09-03 15:32:43.396206

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d15c9bf2d716"
down_revision = "c898ba0e8e77"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE subscriptions SET scheduler_locked = FALSE WHERE scheduler_locked = TRUE;"
    )


def downgrade() -> None:
    pass

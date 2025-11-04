"""Delete MaintainerAccountUnderReviewNotification and MaintainerAccountReviewedNotification notifications

Revision ID: f2e20ffcad2d
Revises: d6809d0a2f67
Create Date: 2025-11-04 10:22:47.818719

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f2e20ffcad2d"
down_revision = "d6809d0a2f67"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM notifications
        WHERE type IN ('MaintainerAccountUnderReviewNotification', 'MaintainerAccountReviewedNotification')
        """
    )


def downgrade() -> None:
    pass

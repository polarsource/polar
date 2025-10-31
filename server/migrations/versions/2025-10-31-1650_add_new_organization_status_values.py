"""add_new_organization_status_values

Revision ID: 2af63e66a18e
Revises: 2c7d8141f6b4
Create Date: 2025-10-31 16:50:46.076228

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "2af63e66a18e"
down_revision = "2c7d8141f6b4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add new enum values to organizationstatus
    op.execute("ALTER TYPE organizationstatus ADD VALUE IF NOT EXISTS 'ready'")
    op.execute("ALTER TYPE organizationstatus ADD VALUE IF NOT EXISTS 'first_review'")
    op.execute("ALTER TYPE organizationstatus ADD VALUE IF NOT EXISTS 'ongoing_review'")
    op.execute("ALTER TYPE organizationstatus ADD VALUE IF NOT EXISTS 'blocked'")

    # Backfill: Migrate organizations with blocked_at set to BLOCKED status
    op.execute(
        """
        UPDATE organizations
        SET status = 'blocked'
        WHERE blocked_at IS NOT NULL
        """
    )

    # Backfill: Migrate UNDER_REVIEW to FIRST_REVIEW
    # We assume all existing UNDER_REVIEW cases are first-time reviews
    op.execute(
        """
        UPDATE organizations
        SET status = 'first_review'
        WHERE status = 'under_review'
        """
    )


def downgrade() -> None:
    # Revert FIRST_REVIEW back to UNDER_REVIEW
    op.execute(
        """
        UPDATE organizations
        SET status = 'under_review'
        WHERE status = 'first_review'
        """
    )

    # Revert BLOCKED status back to using blocked_at
    # Organizations with BLOCKED status should have blocked_at set during upgrade
    op.execute(
        """
        UPDATE organizations
        SET status = 'active'
        WHERE status = 'blocked' AND blocked_at IS NOT NULL
        """
    )

    # Note: PostgreSQL doesn't support removing enum values easily
    # The new enum values (ready, first_review, ongoing_review, blocked) will remain
    # but won't be used after downgrade

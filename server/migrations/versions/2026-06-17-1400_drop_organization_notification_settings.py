"""drop organization.notification_settings

Revision ID: d5f2b8e1c3a9
Revises: c4e1a9f3b2d7
Create Date: 2026-06-17 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d5f2b8e1c3a9"
down_revision = "c4e1a9f3b2d7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Notification settings now live on the membership (user_organizations);
    # the org-level column is no longer read. Drop it.
    op.drop_column("organizations", "notification_settings")


def downgrade() -> None:
    # Re-add organizations.notification_settings, mirroring its original migration.
    op.add_column(
        "organizations",
        sa.Column(
            "notification_settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.execute(
        """
        UPDATE organizations
        SET notification_settings = '{"new_order": true, "new_subscription": true}'
        """
    )
    op.alter_column("organizations", "notification_settings", nullable=False)

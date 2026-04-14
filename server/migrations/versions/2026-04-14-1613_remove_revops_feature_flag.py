"""remove revops feature flag

Revision ID: a1b2c3d4e5f2
Revises: 3da90b684726
Create Date: 2026-04-14 16:13:53.792641

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f2"
down_revision = "3da90b684726"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET feature_settings = feature_settings - 'revops_enabled'
        WHERE feature_settings ? 'revops_enabled'
        """
    )


def downgrade() -> None:
    pass

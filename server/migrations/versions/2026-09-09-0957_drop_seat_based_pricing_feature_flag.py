"""drop seat based pricing feature flag

Revision ID: f9cabfdff143
Revises: 226afe0d783a
Create Date: 2026-09-09 09:57:55.6N

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f9cabfdff143"
down_revision = "226afe0d783a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.execute(
        """
        UPDATE organizations
        SET feature_settings = feature_settings - 'seat_based_pricing_enabled'
        WHERE feature_settings ? 'seat_based_pricing_enabled'
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.execute(
        """
        UPDATE organizations
        SET feature_settings =
            feature_settings || '{"seat_based_pricing_enabled": true}'::jsonb
        WHERE NOT feature_settings ? 'seat_based_pricing_enabled'
        """
    )

"""Add default Organization.feature_settings->'presentment_currencies_enabled'

Revision ID: 6df4681e7cc7
Revises: c5e9f3b2d4a6
Create Date: 2026-02-09 11:11:11.796798

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6df4681e7cc7"
down_revision = "c5e9f3b2d4a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET feature_settings = jsonb_set(
            COALESCE(feature_settings, '{}'),
            '{presentment_currencies_enabled}',
            'false'::jsonb,
            true
        )
        WHERE feature_settings->'presentment_currencies_enabled' IS NULL;
        """
    )


def downgrade() -> None:
    pass

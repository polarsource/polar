"""add enabled profile flag to organization profile settings

Revision ID: 0e09189cb135
Revises: b370fa17e025
Create Date: 2024-09-09 15:42:03.867809

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "0e09189cb135"
down_revision = "b370fa17e025"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE organizations SET profile_settings = jsonb_set(profile_settings, '{enabled}', 'true'::jsonb) WHERE profile_settings->'enabled' IS NULL"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE organizations SET profile_settings = profile_settings - 'enabled' WHERE profile_settings->'enabled' IS NOT NULL"
    )

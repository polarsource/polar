"""disable newsletters

Revision ID: 162775d9f4f2
Revises: be588d8f19ab
Create Date: 2024-09-18 13:18:29.386113

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "162775d9f4f2"
down_revision = "be588d8f19ab"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # set newsletters_enabled in org feature settings to false for all orgs without any posts
    op.execute(
        """
        UPDATE organizations
        SET feature_settings = jsonb_set(feature_settings, '{articles_enabled}', 'false'::jsonb)
        WHERE organizations.id NOT IN (
            SELECT organization_id
            FROM articles
        )
        """
    )


def downgrade() -> None:
    # set newsletters_enabled in org feature settings to true for all orgs with posts
    pass

"""Fix created_from_user_maintainer_upgrade

Revision ID: 9c60487b49ab
Revises: 25988355c01f
Create Date: 2024-04-18 17:01:26.405200

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "9c60487b49ab"
down_revision = "25988355c01f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("""
        UPDATE organizations SET created_from_user_maintainer_upgrade=TRUE
        WHERE id IN (
            SELECT DISTINCT o.id
            FROM organizations o
            JOIN user_organizations uo ON uo.organization_id = o.id
            JOIN oauth_accounts oa ON oa.user_id = uo.user_id AND oa.platform = 'github'
            WHERE o.installation_id IS NULL
            AND o.deleted_at IS NULL
        )
    """)


def downgrade() -> None:
    pass

"""Update GitHub/Discord benefit grant properties

Revision ID: f3109d4baff8
Revises: 3ee37a022b30
Create Date: 2025-09-04 10:28:35.296411

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f3109d4baff8"
down_revision = "3ee37a022b30"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE benefit_grants
        SET properties = benefit_grants.properties || jsonb_build_object('granted_account_id', benefit_grants.properties->>'account_id')
        FROM benefits
        WHERE benefit_grants.benefit_id = benefits.id
        AND benefits.type IN ('github_repository', 'discord')
        AND benefit_grants.properties ? 'account_id'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE benefit_grants
        SET properties = benefit_grants.properties - 'granted_account_id'
        FROM benefits
        WHERE benefit_grants.benefit_id = benefits.id
        AND benefits.type IN ('github_repository', 'discord')
        AND benefit_grants.properties ? 'granted_account_id'
        """
    )

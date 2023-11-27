"""pledge_splits.migrate_data

Revision ID: a50e52aea4ec
Revises: ce3da2ba3f0a
Create Date: 2023-08-10 14:18:41.231221

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "a50e52aea4ec"
down_revision = "ce3da2ba3f0a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Backport pledge_splits from existing pledges
    op.execute(
        """
INSERT INTO pledge_splits (id, issue_id, organization_id, share, created_at)
SELECT gen_random_uuid(),
    p.issue_id as issue_id,
    p.organization_id as organization_id,
    1::int as share,
    NOW()
FROM pledges p
WHERE p.transfer_id IS NOT NULL
GROUP BY p.issue_id, p.organization_id
    """
    )

    # Connect pledge_transactions (transfers) with splits
    op.execute(
        """
WITH sub AS (
    SELECT pt.id as pt_id, ps.id as ps_id
    FROM pledge_transactions pt
    JOIN pledges p ON p.id = pt.pledge_id
    JOIN pledge_splits ps ON ps.issue_id = p.issue_id
    WHERE pt.type = 'transfer'
)
UPDATE pledge_transactions
SET pledge_split_id=sub.ps_id
FROM sub
WHERE id=sub.pt_id;
"""
    )
    pass


def downgrade() -> None:
    pass

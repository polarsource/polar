"""oauth_accounts.account_username

Revision ID: cc3752dd3b05
Revises: 53e30136e41b
Create Date: 2024-03-08 09:58:35.325546

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "cc3752dd3b05"
down_revision = "53e30136e41b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
UPDATE
    oauth_accounts
SET
    account_username = sub.user_username
FROM
    (
        SELECT
            oa.id AS oauth_id,
            u.id AS user_id,
            u.username AS user_username
        FROM
            oauth_accounts oa
            JOIN users u ON u.id = oa.user_id
        WHERE
            oa.account_username IS NULL
            AND oa.platform = 'github'
            AND u.username NOT LIKE '%@%'
    ) AS sub
WHERE
    id = sub.oauth_id
"""
    )


def downgrade() -> None:
    pass

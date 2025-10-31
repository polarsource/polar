"""hard_delete_soft_deleted_oauth_accounts

Revision ID: 147b61ffddbc
Revises: 6632c7d5663e
Create Date: 2025-10-31 11:21:47.674691

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "147b61ffddbc"
down_revision = "6632c7d5663e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM oauth_accounts
        WHERE deleted_at IS NOT NULL
        """
    )


def downgrade() -> None:
    pass

"""Remove old external_events

Revision ID: 9919760fc6cb
Revises: 4b889494f84f
Create Date: 2025-08-18 17:27:53.251630

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9919760fc6cb"
down_revision = "4b889494f84f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM external_events
        WHERE created_at < '2025-04-01T00:00:00Z'
        """
    )


def downgrade() -> None:
    pass

"""Delete Discord OAuth accounts

Revision ID: b61e1c9fa805
Revises: 648a1268ab97
Create Date: 2024-12-16 10:58:48.270386

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b61e1c9fa805"
down_revision = "648a1268ab97"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM oauth_accounts WHERE platform = 'discord'")


def downgrade() -> None:
    pass

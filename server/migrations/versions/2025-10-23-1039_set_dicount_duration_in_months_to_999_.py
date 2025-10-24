"""Set Dicount.duration_in_months to 999 max

Revision ID: e87a34881c93
Revises: bd5e68a512cd
Create Date: 2025-10-23 10:39:12.488423

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e87a34881c93"
down_revision = "bd5e68a512cd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE discounts
        SET duration_in_months = 999
        WHERE duration_in_months > 999
        """
    )


def downgrade() -> None:
    pass

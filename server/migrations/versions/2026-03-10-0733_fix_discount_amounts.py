"""Fix Discount.amounts

Revision ID: a1fd4341cf14
Revises: b5582de8aa27
Create Date: 2026-03-10 07:33:39.440271

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1fd4341cf14"
down_revision = "b5582de8aa27"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE discounts
        SET amounts = jsonb_build_object(
            (SELECT default_presentment_currency FROM organizations WHERE organizations.id = discounts.organization_id),
            0
        )
        WHERE type = 'fixed' AND amounts = '{}'
        """
    )
    op.execute(
        """
        UPDATE discounts
        SET amounts = NULL
        WHERE type != 'fixed' AND amounts = '{}'
        """
    )


def downgrade() -> None:
    pass

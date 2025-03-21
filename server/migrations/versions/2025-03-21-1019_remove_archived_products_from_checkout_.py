"""Remove archived products from checkout links

Revision ID: cbbed7381d63
Revises: 0db0550375a5
Create Date: 2025-03-21 10:19:54.827611

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cbbed7381d63"
down_revision = "0db0550375a5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM checkout_link_products
        WHERE product_id IN (
            SELECT id
            FROM products
            WHERE is_archived = TRUE
        )
    """
    )


def downgrade() -> None:
    pass

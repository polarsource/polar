"""Fix encoded {CHECKOUT_ID} placeholder in success URLs

Revision ID: 37627db663e9
Revises: e55a3eab311e
Create Date: 2026-01-29

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "37627db663e9"
down_revision = "e55a3eab311e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Fix success URLs where {CHECKOUT_ID} was incorrectly URL-encoded
    op.execute(
        """
        UPDATE checkout_links
        SET success_url = REPLACE(success_url, '%7BCHECKOUT_ID%7D', '{CHECKOUT_ID}')
        WHERE success_url LIKE '%#%7BCHECKOUT_ID#%7D%' ESCAPE '#'
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET success_url = REPLACE(success_url, '%7BCHECKOUT_ID%7D', '{CHECKOUT_ID}')
        WHERE success_url LIKE '%#%7BCHECKOUT_ID#%7D%' ESCAPE '#'
        """
    )


def downgrade() -> None:
    # No downgrade - the unescaped placeholder is the correct format
    pass

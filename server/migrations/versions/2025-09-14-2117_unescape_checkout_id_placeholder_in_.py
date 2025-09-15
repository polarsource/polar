"""Unescape checkout_id placeholder in success URLs

Revision ID: 02af7a82e76c
Revises: c26960e60bda
Create Date: 2025-09-14 21:17:08.166830

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "02af7a82e76c"
down_revision = "c26960e60bda"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


ENCODED_PLACEHOLDER = "%7BCHECKOUT_ID%7D"
DECODED_PLACEHOLDER = "{CHECKOUT_ID}"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE checkout_links
        SET success_url = REPLACE(success_url, '{ENCODED_PLACEHOLDER}', '{DECODED_PLACEHOLDER}')
        WHERE success_url LIKE '%{ENCODED_PLACEHOLDER}%'
        """
    )
    op.execute(
        f"""
        UPDATE checkouts
        SET success_url = REPLACE(success_url, '{ENCODED_PLACEHOLDER}', '{DECODED_PLACEHOLDER}')
        WHERE success_url LIKE '%{ENCODED_PLACEHOLDER}%'
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE checkout_links
        SET success_url = REPLACE(success_url, '{DECODED_PLACEHOLDER}', '{ENCODED_PLACEHOLDER}')
        WHERE success_url LIKE '%{DECODED_PLACEHOLDER}%'
        """
    )
    op.execute(
        f"""
        UPDATE checkouts
        SET success_url = REPLACE(success_url, '{DECODED_PLACEHOLDER}', '{ENCODED_PLACEHOLDER}')
        WHERE success_url LIKE '%{DECODED_PLACEHOLDER}%'
        """
    )

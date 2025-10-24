"""add invoice_numbering to subscription_settings

Revision ID: 9b0f38cdd25d
Revises: e87a34881c93
Create Date: 2025-10-23 15:43:43.869159

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9b0f38cdd25d"
down_revision = "e87a34881c93"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET subscription_settings = jsonb_set(
            subscription_settings,
            '{invoice_numbering}',
            '"organization"'::jsonb
        )
        WHERE subscription_settings IS NOT NULL
        AND subscription_settings->>'invoice_numbering' IS NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET subscription_settings = subscription_settings - 'invoice_numbering'
        WHERE subscription_settings ? 'invoice_numbering'
        """
    )

"""Fix deleted Stripe Payout Account

Revision ID: b3af3591c62d
Revises: 797306c0bfde
Create Date: 2026-04-09 11:31:12.566957

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b3af3591c62d"
down_revision = "797306c0bfde"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Mark Stripe payout accounts without stripe_id as deleted
    op.execute(
        """
        UPDATE payout_accounts
        SET deleted_at = NOW()
        WHERE type = 'stripe'
        AND stripe_id IS NULL
        AND deleted_at IS NULL
        """
    )

    # Recover Stripe ID from data for those deleted accounts for consistency, even if they are deleted.
    op.execute(
        """
        UPDATE payout_accounts
        SET stripe_id = (data->>'id')
        WHERE type = 'stripe'
        AND stripe_id IS NULL
        AND deleted_at IS NOT NULL
        """
    )

    # Unlink deleted payout accounts from organizations
    op.execute(
        """
        UPDATE organizations o
        SET payout_account_id = NULL
        FROM payout_accounts pa
        WHERE o.payout_account_id = pa.id
        AND pa.deleted_at IS NOT NULL
        """
    )


def downgrade() -> None:
    pass

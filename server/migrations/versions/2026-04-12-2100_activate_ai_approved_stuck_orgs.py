"""Activate AI-approved organizations stuck in created status

The payout account split (0c9620e7e) removed the Stripe-based activation
path but the replacement AI-based activation on submission (5fe86daf) was
not retroactive. This activates organizations that passed AI review but
were never moved to active.

Revision ID: 8f2a1c3d5e7b
Revises: 3a5de39401e9
Create Date: 2026-04-12 21:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8f2a1c3d5e7b"
down_revision = "3a5de39401e9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE organizations
        SET
            status = 'active',
            status_updated_at = now()
        WHERE
            status = 'created'
            AND deleted_at IS NULL
            AND EXISTS (
                SELECT 1 FROM organization_reviews orv
                WHERE orv.organization_id = organizations.id
                  AND orv.verdict = 'PASS'
            )
            AND EXISTS (
                SELECT 1 FROM organization_agent_reviews oar
                WHERE oar.organization_id = organizations.id
            )
        """
    )


def downgrade() -> None:
    pass

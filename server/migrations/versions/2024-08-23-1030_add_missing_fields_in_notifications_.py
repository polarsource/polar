"""Add missing fields in notifications payloads

Revision ID: 859b8df4d1cf
Revises: 806a7aac6884
Create Date: 2024-08-23 10:30:42.441364

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "859b8df4d1cf"
down_revision = "806a7aac6884"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_id}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_type' IS NULL AND type = 'MaintainerPledgeCreatedNotification'
        """
    )
    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_type}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_type' IS NULL AND type = 'MaintainerPledgeCreatedNotification'
        """
    )

    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_id}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_id' IS NULL AND type = 'MaintainerPledgeConfirmationPendingNotification'
        """
    )

    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_id}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_id' IS NULL AND type = 'MaintainerPledgePendingNotification'
        """
    )

    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_id}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_id' IS NULL AND type = 'MaintainerPledgePaidNotification'
        """
    )

    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_id}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_id' IS NULL AND type = 'PledgerPledgePendingNotification'
        """
    )
    op.execute(
        """
        UPDATE notifications
        SET payload = jsonb_set(
            payload,
            '{pledge_type}',
            'null'::jsonb,
            true
        )
        WHERE payload->>'pledge_type' IS NULL AND type = 'PledgerPledgePendingNotification'
        """
    )


def downgrade() -> None:
    pass

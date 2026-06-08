"""Remove MaintainerCreateAccountNotification notifications

Revision ID: ea537f8efa51
Revises: 31bc85d4a4c4
Create Date: 2026-06-08 14:14:29.738325

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ea537f8efa51"
down_revision = "31bc85d4a4c4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # The `MaintainerCreateAccountNotification` type and its payload have been
    # removed from the notifications discriminated union. Any remaining rows of
    # this type would fail to deserialize when returned by the /notifications
    # endpoint, so delete them.
    op.execute(
        """
        DELETE FROM notifications
        WHERE type = 'MaintainerCreateAccountNotification'
        """
    )


def downgrade() -> None:
    pass

"""Delete backup codes if TOTP is not available

Revision ID: fe0c257b531e
Revises: ea537f8efa51
Create Date: 2026-06-08 19:28:38.857184

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "fe0c257b531e"
down_revision = "ea537f8efa51"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        """
        DELETE FROM backup_codes_enrollments
        WHERE identity_id NOT IN (
            SELECT identity_id
            FROM totp_enrollments
        )
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    pass

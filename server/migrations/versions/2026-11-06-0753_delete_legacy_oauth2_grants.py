"""delete legacy oauth2 grants

Revision ID: 57e6b4862574
Revises: 7556261cda9f
Create Date: 2026-11-04 10:23:31.257305

"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "57e6b4862574"
down_revision = "7556261cda9f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

# Consent fix deployment: https://github.com/polarsource/polar/actions/runs/41813539755
CONSENT_CUTOVER = datetime(2026, 11, 4, 10, 27, 13, tzinfo=UTC)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        sa.text(
            """
            DELETE FROM oauth2_grants
            WHERE COALESCE(modified_at, created_at) < :cutover
            """
        ).bindparams(cutover=CONSENT_CUTOVER)
    )


def downgrade() -> None:
    # Deleted consent records cannot be reconstructed.
    pass

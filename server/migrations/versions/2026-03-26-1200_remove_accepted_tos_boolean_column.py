"""Remove accepted_terms_of_service boolean column

Revision ID: c7f2e9d1a3b6
Revises: 8a3f1b2c4d5e
Create Date: 2026-03-26 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c7f2e9d1a3b6"
down_revision = "8a3f1b2c4d5e"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Backfill accepted_terms_of_service_at for users who accepted but don't
    # have the timestamp yet (accepted before the _at column was added).
    op.execute(
        sa.text("""
        UPDATE users
        SET accepted_terms_of_service_at = now()
        WHERE accepted_terms_of_service = TRUE
          AND accepted_terms_of_service_at IS NULL
        """)
    )

    op.drop_column("users", "accepted_terms_of_service")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "accepted_terms_of_service",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # Restore boolean from timestamp
    op.execute(
        sa.text("""
        UPDATE users
        SET accepted_terms_of_service = TRUE
        WHERE accepted_terms_of_service_at IS NOT NULL
        """)
    )

"""add sso provenance flag to user_session_organizations

Revision ID: a1b2c3d4e5f6
Revises: fec1e6242c3f
Create Date: 2026-09-06 1200

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "fec1e6242c3f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_session_organizations",
        sa.Column(
            "sso",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("user_session_organizations", "sso")

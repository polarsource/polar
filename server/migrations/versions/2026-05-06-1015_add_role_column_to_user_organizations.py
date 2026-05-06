"""add role column to user_organizations

Revision ID: d0d27f5aa3cc
Revises: 199179085ab4
Create Date: 2026-05-06 10:15:09.141786

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "d0d27f5aa3cc"
down_revision = "199179085ab4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '2s'")
    op.add_column(
        "user_organizations",
        sa.Column(
            "role",
            sa.String(),
            server_default="member",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_organizations", "role")

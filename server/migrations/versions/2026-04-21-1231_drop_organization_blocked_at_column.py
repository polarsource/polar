"""drop organization blocked_at column

Revision ID: 8b15254e76ab
Revises: 532186b5c028
Create Date: 2026-04-21 12:31:19.484844

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8b15254e76ab"
down_revision = "532186b5c028"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_column("organizations", "blocked_at")


def downgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "blocked_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )

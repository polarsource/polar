"""add last_authenticated_at to user_sessions

Revision ID: c1f3a9d2b4e7
Revises: 8495fffc409d
Create Date: 2026-07-07 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c1f3a9d2b4e7"
down_revision = "8495fffc409d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Nullable, no server default: avoids a table rewrite; old rows fall back
    # to created_at in code.
    op.add_column(
        "user_sessions",
        sa.Column("last_authenticated_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_sessions", "last_authenticated_at")

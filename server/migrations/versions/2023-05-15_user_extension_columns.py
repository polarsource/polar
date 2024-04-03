"""user extension columns

Revision ID: f39358a2df88
Revises: c228c42e2443
Create Date: 2023-05-15 10:29:32.763000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f39358a2df88"
down_revision = "c228c42e2443"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_seen_at_extension", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("last_version_extension", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_version_extension")
    op.drop_column("users", "last_seen_at_extension")

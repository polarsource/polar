"""notifications.user_id

Revision ID: 6dd578878fc3
Revises: f39358a2df88
Create Date: 2023-05-16 15:40:30.205094

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6dd578878fc3"
down_revision = "f39358a2df88"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("TRUNCATE notifications")
    op.add_column("notifications", sa.Column("user_id", sa.UUID(), nullable=False))
    op.drop_column("notifications", "organization_id")


def downgrade() -> None:
    op.execute("TRUNCATE notifications")
    op.add_column(
        "notifications",
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_column("notifications", "user_id")

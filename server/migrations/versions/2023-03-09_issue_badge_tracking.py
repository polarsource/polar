"""issue badge tracking

Revision ID: 6e8d1daa9f24
Revises: c5ca17f7ae00
Create Date: 2023-03-09 13:19:58.364845

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6e8d1daa9f24"
down_revision = "c5ca17f7ae00"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "issues",
        sa.Column(
            "funding_badge_embedded_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("issues", "funding_badge_embedded_at")

"""issue polling columns

Revision ID: 240cf2f2c2f4
Revises: f39358a2df88
Create Date: 2023-05-17 09:39:33.768485

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "240cf2f2c2f4"
down_revision = "f39358a2df88"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("github_issue_etag", sa.String(), nullable=True))
    op.add_column(
        "issues",
        sa.Column(
            "github_issue_fetched_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("issues", "github_issue_fetched_at")
    op.drop_column("issues", "github_issue_etag")

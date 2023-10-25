"""issue has pledge badge label

Revision ID: 4add676cc1fe
Revises: 51818b6106c9
Create Date: 2023-05-29 22:49:41.105799

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "4add676cc1fe"
down_revision = "51818b6106c9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "issues",
        sa.Column(
            "has_pledge_badge_label",
            sa.Boolean(),
            nullable=False,
            server_default="F",
        ),
    )


def downgrade() -> None:
    op.drop_column("issues", "has_pledge_badge_label")

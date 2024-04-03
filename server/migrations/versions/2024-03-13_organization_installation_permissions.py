"""organization.installation_permissions

Revision ID: c9ce14962bcb
Revises: b092f14cece0
Create Date: 2024-03-13 15:26:15.329106

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "c9ce14962bcb"
down_revision = "b092f14cece0"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "installation_permissions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("organizations", "installation_permissions")

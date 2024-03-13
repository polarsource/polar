"""organization.status

Revision ID: b33d5e1c4a6c
Revises: c9ce14962bcb
Create Date: 2024-03-13 18:01:51.365074

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "b33d5e1c4a6c"
down_revision = "c9ce14962bcb"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_column("organizations", "status")


def downgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "status",
            sa.VARCHAR(length=20),
            server_default=sa.text("'active'::character varying"),
            autoincrement=False,
            nullable=False,
        ),
    )

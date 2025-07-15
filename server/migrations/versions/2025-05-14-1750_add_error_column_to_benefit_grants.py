"""Add error column to benefit grants

Revision ID: 133b23057e2f
Revises: 173ca3810487
Create Date: 2025-05-14 17:50:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "133b23057e2f"
down_revision = "173ca3810487"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("benefit_grants", sa.Column("error", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("benefit_grants", "error")

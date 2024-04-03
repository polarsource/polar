"""organization onboarding settings

Revision ID: c5ca17f7ae00
Revises: c6af58446381
Create Date: 2023-03-07 19:46:30.021072

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c5ca17f7ae00"
down_revision = "c6af58446381"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column("organizations", "status", server_default="active")
    op.add_column(
        "organizations",
        sa.Column(
            "funding_badge_retroactive",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "funding_badge_show_amount",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "organizations",
        sa.Column("onboarded_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.alter_column("organizations", "status", server_default="inactive")
    op.drop_column("organizations", "funding_badge_retroactive")
    op.drop_column("organizations", "funding_badge_show_amount")
    op.drop_column("organizations", "onboarded_at")

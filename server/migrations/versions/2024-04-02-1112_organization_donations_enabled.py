"""organization.donations_enabled

Revision ID: 28c63f49ab81
Revises: 87d41d1dad71
Create Date: 2024-04-02 11:12:59.036668

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "28c63f49ab81"
down_revision = "87d41d1dad71"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "organizations", sa.Column("donations_enabled", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE organizations SET donations_enabled=FALSE")
    op.alter_column("organizations", "donations_enabled", nullable=False)


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("organizations", "donations_enabled")
    # ### end Alembic commands ###

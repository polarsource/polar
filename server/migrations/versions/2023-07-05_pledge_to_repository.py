"""pledge.to_repository

Revision ID: ec055c88d51c
Revises: e1649ad1d26b
Create Date: 2023-07-05 19:57:18.005872

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "ec055c88d51c"
down_revision = "e1649ad1d26b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "repositories", "organization_id", existing_type=sa.UUID(), nullable=False
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "repositories", "organization_id", existing_type=sa.UUID(), nullable=True
    )
    # ### end Alembic commands ###

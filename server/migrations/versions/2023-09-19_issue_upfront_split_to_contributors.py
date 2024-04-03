"""issue.upfront_split_to_contributors

Revision ID: 71b0057689a6
Revises: 8d213a6d9251
Create Date: 2023-09-19 15:30:44.311641

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "71b0057689a6"
down_revision = "8d213a6d9251"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "issues",
        sa.Column("upfront_split_to_contributors", sa.Integer(), nullable=True),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("issues", "upfront_split_to_contributors")
    # ### end Alembic commands ###

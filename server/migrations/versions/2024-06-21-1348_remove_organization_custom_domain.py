"""Remove Organization.custom_domain

Revision ID: ca130161bf6a
Revises: 8e40457497a3
Create Date: 2024-06-21 13:48:14.670304

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "ca130161bf6a"
down_revision = "8e40457497a3"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        "organizations_custom_domain_key", "organizations", type_="unique"
    )
    op.drop_column("organizations", "custom_domain")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "organizations",
        sa.Column("custom_domain", sa.VARCHAR(), autoincrement=False, nullable=True),
    )
    op.create_unique_constraint(
        "organizations_custom_domain_key", "organizations", ["custom_domain"]
    )
    # ### end Alembic commands ###

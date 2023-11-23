"""articles.slug

Revision ID: 1d30c41686e8
Revises: 86fd6ef89af7
Create Date: 2023-11-23 16:25:53.651373

"""
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "1d30c41686e8"
down_revision = "86fd6ef89af7"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_unique_constraint(
        op.f("articles_organization_id_slug_key"),
        "articles",
        ["organization_id", "slug"],
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("articles_organization_id_slug_key"), "articles", type_="unique"
    )
    # ### end Alembic commands ###

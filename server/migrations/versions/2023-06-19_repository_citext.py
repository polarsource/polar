"""repository.citext

Revision ID: e3baa1506821
Revises: 5588a206e38a
Create Date: 2023-06-19 09:15:46.195983

"""
import citext
import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "e3baa1506821"
down_revision = "5588a206e38a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "repositories",
        "name",
        existing_type=sa.VARCHAR(),
        type_=citext.CIText(),
        existing_nullable=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "repositories",
        "name",
        existing_type=citext.CIText(),
        type_=sa.VARCHAR(),
        existing_nullable=False,
    )
    # ### end Alembic commands ###

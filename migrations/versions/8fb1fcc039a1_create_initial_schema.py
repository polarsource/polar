"""create initial schema

Revision ID: 8fb1fcc039a1
Revises: 
Create Date: 2023-01-26 23:01:23.923123

"""
import sqlalchemy as sa
from alembic import op

from polar.ext.sqlalchemy import GUID

# revision identifiers, used by Alembic.
revision: str = "8fb1fcc039a1"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def create_demo() -> None:
    op.create_table(
        "demo",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("testing", sa.Unicode(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def drop_demo() -> None:
    op.drop_table("demo")


def upgrade() -> None:
    create_demo()


def downgrade() -> None:
    drop_demo()

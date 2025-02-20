"""Remove Customer.user_id

Revision ID: cb77e86b9e13
Revises: 21585ed16305
Create Date: 2025-02-20 16:32:07.915989

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "cb77e86b9e13"
down_revision = "21585ed16305"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint("customers_user_id_fkey", "customers", type_="foreignkey")
    op.drop_column("customers", "user_id")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "customers", sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=True)
    )
    op.create_foreign_key(
        "customers_user_id_fkey",
        "customers",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # ### end Alembic commands ###

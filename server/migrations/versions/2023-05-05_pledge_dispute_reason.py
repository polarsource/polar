"""pledge.dispute_reason

Revision ID: 4490b9736177
Revises: 7dd51b876016
Create Date: 2023-05-05 14:23:53.782486

"""
from alembic import op
import sqlalchemy as sa


# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "4490b9736177"
down_revision = "7dd51b876016"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column("pledges", sa.Column("dispute_reason", sa.String(), nullable=True))
    op.add_column("pledges", sa.Column("disputed_by_user_id", sa.UUID(), nullable=True))
    op.add_column(
        "pledges", sa.Column("disputed_at", sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        op.f("pledges_disputed_by_user_id_fkey"),
        "pledges",
        "users",
        ["disputed_by_user_id"],
        ["id"],
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("pledges_disputed_by_user_id_fkey"), "pledges", type_="foreignkey"
    )
    op.drop_column("pledges", "disputed_at")
    op.drop_column("pledges", "disputed_by_user_id")
    op.drop_column("pledges", "dispute_reason")
    # ### end Alembic commands ###

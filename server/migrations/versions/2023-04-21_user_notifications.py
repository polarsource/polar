"""user_notifications

Revision ID: b6e372d137bc
Revises: 7673b323ea37
Create Date: 2023-04-21 10:07:48.406986

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b6e372d137bc"
down_revision = "7673b323ea37"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "user_notifications",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("last_read_notification_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("user_notifications_user_id_fkey")
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("user_notifications_pkey")),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("user_notifications")
    # ### end Alembic commands ###

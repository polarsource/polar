"""webhook_notificatioons

Revision ID: 9006f0c3bea2
Revises: 10807a5d65b9
Create Date: 2023-12-21 16:01:57.461591

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "9006f0c3bea2"
down_revision = "10807a5d65b9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "webhook_notifications",
        sa.Column("integration", sa.String(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("webhook_notifications_organization_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("webhook_notifications_pkey")),
    )
    op.create_index(
        op.f("ix_webhook_notifications_organization_id"),
        "webhook_notifications",
        ["organization_id"],
        unique=False,
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(
        op.f("ix_webhook_notifications_organization_id"),
        table_name="webhook_notifications",
    )
    op.drop_table("webhook_notifications")
    # ### end Alembic commands ###

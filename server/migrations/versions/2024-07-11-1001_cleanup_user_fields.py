"""Cleanup user fields

Revision ID: 3020ecbe171e
Revises: 43164d237316
Create Date: 2024-07-11 10:01:16.351905

"""

import asyncio

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3020ecbe171e"
down_revision = "43164d237316"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("users", "profile")
    op.drop_column("users", "email_promotions_and_events")
    op.drop_column("users", "email_newsletters_and_changelogs")
    op.drop_column("users", "invite_only_approved")
    op.drop_column("users", "last_version_extension")
    op.drop_column("users", "last_seen_at_extension")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "users",
        sa.Column(
            "last_seen_at_extension",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_version_extension",
            sa.VARCHAR(length=50),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "invite_only_approved", sa.BOOLEAN(), autoincrement=False, nullable=False
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_newsletters_and_changelogs",
            sa.BOOLEAN(),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "email_promotions_and_events",
            sa.BOOLEAN(),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "profile",
            postgresql.JSONB(astext_type=sa.Text()),
            autoincrement=False,
            nullable=True,
        ),
    )
    # ### end Alembic commands ###

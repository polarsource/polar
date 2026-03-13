"""drop events_closure table

Revision ID: f43048f9cd3a
Revises: 9b73bce01fd4
Create Date: 2026-03-13 09:11:31.106042

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f43048f9cd3a"
down_revision = "9b73bce01fd4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_events_closure_ancestor_descendant", table_name="events_closure")
    op.drop_index("ix_events_closure_descendant_ancestor", table_name="events_closure")
    op.drop_table("events_closure")


def downgrade() -> None:
    op.create_table(
        "events_closure",
        sa.Column("ancestor_id", sa.Uuid(), nullable=False),
        sa.Column("descendant_id", sa.Uuid(), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["ancestor_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["descendant_id"], ["events.id"]),
        sa.PrimaryKeyConstraint("ancestor_id", "descendant_id"),
    )
    op.create_index(
        "ix_events_closure_ancestor_descendant",
        "events_closure",
        ["ancestor_id", "descendant_id", "depth"],
    )
    op.create_index(
        "ix_events_closure_descendant_ancestor",
        "events_closure",
        ["descendant_id", "ancestor_id", "depth"],
    )

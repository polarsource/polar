"""Add composite index on events (organization_id, source, id)

Revision ID: 8c4a2b3d5e6f
Revises: 916e176efd47
Create Date: 2025-12-26 10:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8c4a2b3d5e6f"
down_revision = "916e176efd47"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_events_organization_id_source_id",
            "events",
            ["organization_id", "source", "id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_index("ix_events_organization_id_source_id", table_name="events")

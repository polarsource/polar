"""Fix events external_id unique index to be composite with organization_id

Revision ID: 3a7b8c9d0e1f
Revises: 29aafbbcbe45
Create Date: 2026-01-16

"""

from alembic import op

revision = "3a7b8c9d0e1f"
down_revision = "29aafbbcbe45"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Drop the old unique index on external_id alone
    op.drop_index(op.f("ix_events_external_id"), table_name="events")

    # Create new composite unique index on (organization_id, external_id)
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_events_organization_id_external_id",
            "events",
            ["organization_id", "external_id"],
            unique=True,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    # Drop the composite unique index
    op.drop_index("ix_events_organization_id_external_id", table_name="events")

    # Recreate the original unique index on external_id alone
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_events_external_id"),
            "events",
            ["external_id"],
            unique=True,
            postgresql_concurrently=True,
        )

"""drop ix_events_timestamp

Revision ID: 3f7b9c0e5a12
Revises: 367fe9fac05f
Create Date: 2026-11-12 12:02:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3f7b9c0e5a12"
down_revision = "367fe9fac05f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_events_timestamp",
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            "ix_events_timestamp",
            "events",
            ["timestamp"],
            if_not_exists=True,
            postgresql_concurrently=True,
        )

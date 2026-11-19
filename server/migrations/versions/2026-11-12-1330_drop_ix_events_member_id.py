"""drop ix_events_member_id

Revision ID: 5c1e8a3f9d27
Revises: 8a4d2f6b1e93
Create Date: 2026-11-12 13:30:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5c1e8a3f9d27"
down_revision = "8a4d2f6b1e93"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_events_member_id",
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                "ix_events_member_id",
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                "ix_events_member_id",
                "events",
                ["member_id"],
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")

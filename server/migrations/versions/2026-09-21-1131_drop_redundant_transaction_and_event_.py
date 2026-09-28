"""drop redundant transaction and event indexes

Revision ID: 01a1245dc86e
Revises: 8aa7e7e94a61
Create Date: 2026-09-21 11:31:22.057103

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "01a1245dc86e"
down_revision = "8aa7e7e94a61"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEXES = (
    ("ix_event_types_name", "event_types", "name"),
    ("ix_events_organization_id", "events", "organization_id"),
    ("ix_transactions_account_id", "transactions", "account_id"),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, _ in INDEXES:
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, column in INDEXES:
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    name,
                    table,
                    [column],
                    unique=False,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")

"""remove unused transaction indexes

Revision ID: 0ca20ea806d4
Revises: 38a9961f9d09
Create Date: 2026-09-16 20:45:52.552650

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "1e1927f940ee"
down_revision = "0ca20ea806d4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_COLUMNS = (
    "processor",
    "tax_state",
    "transfer_id",
    "transfer_reversal_id",
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            for column in INDEX_COLUMNS:
                op.drop_index(
                    op.f(f"ix_transactions_{column}"),
                    table_name="transactions",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            for column in INDEX_COLUMNS:
                # Remove any invalid index left by an interrupted concurrent build.
                op.drop_index(
                    op.f(f"ix_transactions_{column}"),
                    table_name="transactions",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    op.f(f"ix_transactions_{column}"),
                    "transactions",
                    [column],
                    unique=False,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")

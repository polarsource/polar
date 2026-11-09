"""move merchant migrations from cleanup to completed

Revision ID: 8675636fe905
Revises: 2f0166e64014
Create Date: 2026-10-28 13:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8675636fe905"
down_revision = "2f0166e64014"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        """
        UPDATE merchant_migrations
        SET step = 'completed',
            source_credentials = source_credentials - 'api_key_encrypted'
        WHERE step = 'cleanup'
        """
    )


def downgrade() -> None:
    # The deleted keys can't be restored, and a `completed` row no longer says
    # whether it was `cleanup` before, so there is nothing to undo.
    pass

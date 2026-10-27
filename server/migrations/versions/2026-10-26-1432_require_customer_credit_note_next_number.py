"""require customer credit note next number

Revision ID: a38dbe96722b
Revises: 90de2eec8efe
Create Date: 2026-10-26 14:32:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "a38dbe96722b"
down_revision = "90de2eec8efe"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        "UPDATE customers SET credit_note_next_number = 1 WHERE credit_note_next_number IS NULL"
    )
    op.alter_column(
        "customers",
        "credit_note_next_number",
        existing_type=sa.INTEGER(),
        nullable=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.alter_column(
        "customers",
        "credit_note_next_number",
        existing_type=sa.INTEGER(),
        nullable=True,
    )

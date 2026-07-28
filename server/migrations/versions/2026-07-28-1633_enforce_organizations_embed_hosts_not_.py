"""enforce organizations embed_hosts not null

Revision ID: 45773b693045
Revises: b493ccc15e3f
Create Date: 2026-07-28 16:33:09.615815

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "45773b693045"
down_revision = "b493ccc15e3f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.execute("UPDATE organizations SET embed_hosts = '[]' WHERE embed_hosts IS NULL")
    op.alter_column(
        "organizations",
        "embed_hosts",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    # `organizations` is a busy table: allow longer to acquire the lock.
    op.execute("SET LOCAL lock_timeout = '30s'")
    op.alter_column(
        "organizations",
        "embed_hosts",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )

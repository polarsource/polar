"""Add index on email_template to email_logs

Revision ID: 565c75e65f2d
Revises: c1a7e4b93f2d
Create Date: 2026-08-11 08:30:35.506229

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "565c75e65f2d"
down_revision = "c1a7e4b93f2d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX = "ix_email_logs_email_template"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        # Drop any INVALID leftover from an interrupted concurrent build first.
        op.drop_index(
            INDEX,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.create_index(
            INDEX,
            "email_logs",
            ["email_template"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            INDEX,
            table_name="email_logs",
            if_exists=True,
            postgresql_concurrently=True,
        )

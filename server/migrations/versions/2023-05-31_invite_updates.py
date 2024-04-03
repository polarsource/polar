"""invite updates

Revision ID: eb00a572b25b
Revises: 2b9e32f55fab
Create Date: 2023-05-31 09:01:19.248014

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "eb00a572b25b"
down_revision = "2b9e32f55fab"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column("invites", sa.Column("note", sa.String(), nullable=True))
    op.drop_column("invites", "sent_to_email")


def downgrade() -> None:
    op.drop_column("invites", "note")
    op.add_column(
        "invites",
        sa.Column("sent_to_email", sa.String(), nullable=True),
    )

"""skip storing presigned metadata

Revision ID: 9961ac3d4071
Revises: 12e1632fb710
Create Date: 2024-05-15 16:44:31.887700

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.extensions.sqlalchemy import PostgresUUID

# revision identifiers, used by Alembic.
revision = "9961ac3d4071"
down_revision = "12e1632fb710"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column("files", "key", new_column_name="path")
    op.alter_column("files", "version_id", new_column_name="s3_version_id")
    op.drop_column("files", "status")

    op.add_column(
        "files",
        sa.Column(
            "upload_id",
            sa.String,
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("files", "presign_expires_at")
    op.drop_column("files", "presign_expiration")
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column("files", "path", new_column_name="key")
    op.alter_column("files", "s3_version_id", new_column_name="version_id")
    op.add_column(
        "files",
        sa.Column(
            "status",
            sa.String,
            autoincrement=False,
            nullable=True,
        ),
    )
    op.drop_column("files", "upload_id")
    op.add_column(
        "files",
        sa.Column(
            "presign_expires_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
    )
    op.add_column(
        "files",
        sa.Column(
            "presign_expiration", sa.INTEGER(), autoincrement=False, nullable=True
        ),
    )
    # ### end Alembic commands ###

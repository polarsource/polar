"""Add oauth_logo file type support

Make files.organization_id nullable and add files.user_id column to support
user-scoped file uploads (e.g. OAuth app logos).

Revision ID: d7f1a2b3c4e5
Revises: c5e9f3b2d4a6
Create Date: 2026-02-05 14:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d7f1a2b3c4e5"
down_revision = "c5e9f3b2d4a6"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.alter_column("files", "organization_id", existing_type=sa.Uuid(), nullable=True)
    op.add_column("files", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("files_user_id_fkey"),
        "files",
        "users",
        ["user_id"],
        ["id"],
        ondelete="cascade",
    )
    op.create_index(op.f("ix_files_user_id"), "files", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_files_user_id"), table_name="files")
    op.drop_constraint(op.f("files_user_id_fkey"), "files", type_="foreignkey")
    op.drop_column("files", "user_id")
    op.alter_column("files", "organization_id", existing_type=sa.Uuid(), nullable=False)

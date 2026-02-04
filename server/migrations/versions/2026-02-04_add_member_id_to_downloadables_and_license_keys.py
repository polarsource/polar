"""Add member_id to downloadables and license_keys

Revision ID: b4d8f2a1c3e5
Revises: a3b7c9d1e2f4
Create Date: 2026-02-04 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b4d8f2a1c3e5"
down_revision = "a3b7c9d1e2f4"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add nullable columns — non-blocking on large tables
    op.add_column(
        "downloadables",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "license_keys",
        sa.Column("member_id", sa.Uuid(), nullable=True),
    )

    # Create indexes concurrently to avoid blocking reads/writes on large tables
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_downloadables_member_id"),
            "downloadables",
            ["member_id"],
            unique=False,
            postgresql_concurrently=True,
        )
        op.create_index(
            op.f("ix_license_keys_member_id"),
            "license_keys",
            ["member_id"],
            unique=False,
            postgresql_concurrently=True,
        )

    # Add foreign key constraints as NOT VALID to avoid a full table scan
    # under ACCESS EXCLUSIVE lock. Then validate separately (only takes
    # SHARE UPDATE EXCLUSIVE, which doesn't block reads or writes).
    op.execute(
        """
        ALTER TABLE downloadables
        ADD CONSTRAINT downloadables_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        NOT VALID
        """
    )
    op.execute(
        """
        ALTER TABLE license_keys
        ADD CONSTRAINT license_keys_member_id_fkey
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        NOT VALID
        """
    )
    op.execute(
        "ALTER TABLE downloadables VALIDATE CONSTRAINT downloadables_member_id_fkey"
    )
    op.execute(
        "ALTER TABLE license_keys VALIDATE CONSTRAINT license_keys_member_id_fkey"
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("license_keys_member_id_fkey"),
        "license_keys",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("downloadables_member_id_fkey"),
        "downloadables",
        type_="foreignkey",
    )

    with op.get_context().autocommit_block():
        op.drop_index(
            op.f("ix_license_keys_member_id"),
            table_name="license_keys",
            postgresql_concurrently=True,
        )
        op.drop_index(
            op.f("ix_downloadables_member_id"),
            table_name="downloadables",
            postgresql_concurrently=True,
        )

    op.drop_column("license_keys", "member_id")
    op.drop_column("downloadables", "member_id")

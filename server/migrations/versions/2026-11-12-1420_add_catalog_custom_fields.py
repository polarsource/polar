"""add catalog_custom_fields and catalog columns to custom_fields

Revision ID: b38e1fd8a5a5
Revises: d62a0b8e4c75
Create Date: 2026-11-12 14:20:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b38e1fd8a5a5"
down_revision = "d62a0b8e4c75"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def _constraint_validated(name: str, table: str) -> bool | None:
    if op.get_context().as_sql:
        return None
    return op.get_bind().scalar(
        sa.text(
            "SELECT convalidated FROM pg_constraint "
            "WHERE conname = :name AND conrelid = to_regclass(:table)"
        ),
        {"name": name, "table": table},
    )


def _ensure_foreign_key(
    name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    *,
    ondelete: str,
) -> None:
    validated = _constraint_validated(name, source_table)
    if validated is None:
        # ShareRowExclusiveLock only: doesn't block reads on either table.
        op.create_foreign_key(
            name,
            source_table,
            referent_table,
            local_cols,
            ["id"],
            ondelete=ondelete,
            postgresql_not_valid=True,
        )
    if not validated:
        # ShareUpdateExclusiveLock only: blocks neither reads nor writes.
        op.execute(f"ALTER TABLE {source_table} VALIDATE CONSTRAINT {name}")


def upgrade() -> None:
    # Each statement commits on its own, so no lock on custom_fields is held
    # across steps or carried into later migrations.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # A constant default fills existing rows without a table rewrite.
            # NOT NULL is enforced in a later migration (ADR-0006).
            op.execute(
                "ALTER TABLE custom_fields "
                "ADD COLUMN IF NOT EXISTS catalog_id UUID, "
                "ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true"
            )
            _ensure_foreign_key(
                op.f("custom_fields_catalog_id_fkey"),
                "custom_fields",
                "catalogs",
                ["catalog_id"],
                ondelete="restrict",
            )

            op.create_table(
                "catalog_custom_fields",
                sa.Column("catalog_id", sa.Uuid(), nullable=False),
                sa.Column("custom_field_id", sa.Uuid(), nullable=False),
                sa.Column("slug", postgresql.CITEXT(), nullable=False),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(
                    ["catalog_id"],
                    ["catalogs.id"],
                    name=op.f("catalog_custom_fields_catalog_id_fkey"),
                    ondelete="cascade",
                ),
                sa.PrimaryKeyConstraint("id", name=op.f("catalog_custom_fields_pkey")),
                sa.UniqueConstraint(
                    "catalog_id",
                    "custom_field_id",
                    name=op.f("catalog_custom_fields_catalog_id_custom_field_id_key"),
                ),
                sa.UniqueConstraint(
                    "catalog_id",
                    "slug",
                    name=op.f("catalog_custom_fields_catalog_id_slug_key"),
                ),
                if_not_exists=True,
            )
            for column in ("created_at", "deleted_at", "custom_field_id"):
                op.create_index(
                    op.f(f"ix_catalog_custom_fields_{column}"),
                    "catalog_custom_fields",
                    [column],
                    unique=False,
                    if_not_exists=True,
                )
            # The table is empty, so validating right away scans nothing.
            _ensure_foreign_key(
                op.f("catalog_custom_fields_custom_field_id_fkey"),
                "catalog_custom_fields",
                "custom_fields",
                ["custom_field_id"],
                ondelete="restrict",
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_table("catalog_custom_fields", if_exists=True)
            op.drop_constraint(
                op.f("custom_fields_catalog_id_fkey"),
                "custom_fields",
                type_="foreignkey",
                if_exists=True,
            )
            op.execute(
                "ALTER TABLE custom_fields "
                "DROP COLUMN IF EXISTS is_current, "
                "DROP COLUMN IF EXISTS catalog_id"
            )
        finally:
            op.execute("RESET lock_timeout")

"""add catalog_benefits and catalog columns to benefits

Revision ID: 3b9e5d2a7c41
Revises: e4c93484fe51
Create Date: 2026-10-27 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3b9e5d2a7c41"
down_revision = "e4c93484fe51"
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
    # Each statement commits on its own, so no lock on benefits is held
    # across steps or carried into later migrations.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # A constant default fills existing rows without a table rewrite.
            # NOT NULL is enforced in a later migration (ADR-0006).
            op.execute(
                "ALTER TABLE benefits "
                "ADD COLUMN IF NOT EXISTS catalog_id UUID, "
                "ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true"
            )
            _ensure_foreign_key(
                op.f("benefits_catalog_id_fkey"),
                "benefits",
                "catalogs",
                ["catalog_id"],
                ondelete="restrict",
            )

            op.create_table(
                "catalog_benefits",
                sa.Column("catalog_id", sa.Uuid(), nullable=False),
                sa.Column("benefit_id", sa.Uuid(), nullable=False),
                sa.Column("external_id", sa.String(), nullable=False),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(
                    ["catalog_id"],
                    ["catalogs.id"],
                    name=op.f("catalog_benefits_catalog_id_fkey"),
                    ondelete="cascade",
                ),
                sa.PrimaryKeyConstraint("id", name=op.f("catalog_benefits_pkey")),
                sa.UniqueConstraint(
                    "catalog_id",
                    "external_id",
                    name=op.f("catalog_benefits_catalog_id_external_id_key"),
                ),
                sa.UniqueConstraint(
                    "catalog_id",
                    "benefit_id",
                    name=op.f("catalog_benefits_catalog_id_benefit_id_key"),
                ),
                if_not_exists=True,
            )
            for column in ("created_at", "deleted_at", "benefit_id"):
                op.create_index(
                    op.f(f"ix_catalog_benefits_{column}"),
                    "catalog_benefits",
                    [column],
                    unique=False,
                    if_not_exists=True,
                )
            # The table is empty, so validating right away scans nothing.
            _ensure_foreign_key(
                op.f("catalog_benefits_benefit_id_fkey"),
                "catalog_benefits",
                "benefits",
                ["benefit_id"],
                ondelete="restrict",
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_table("catalog_benefits", if_exists=True)
            op.drop_constraint(
                op.f("benefits_catalog_id_fkey"),
                "benefits",
                type_="foreignkey",
                if_exists=True,
            )
            op.execute(
                "ALTER TABLE benefits "
                "DROP COLUMN IF EXISTS is_current, "
                "DROP COLUMN IF EXISTS catalog_id"
            )
        finally:
            op.execute("RESET lock_timeout")

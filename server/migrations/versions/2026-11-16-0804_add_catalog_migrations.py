"""add catalog_migrations

Revision ID: 3989f5582200
Revises: f09f2f11e21c
Create Date: 2026-11-16 08:04:01.611066

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "3989f5582200"
down_revision = "f09f2f11e21c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def _ensure_foreign_key(
    name: str, referent_table: str, column: str, *, ondelete: str
) -> None:
    if not op.get_context().as_sql:
        exists = op.get_bind().scalar(
            sa.text(
                "SELECT 1 FROM pg_constraint "
                "WHERE conname = :name "
                "AND conrelid = to_regclass('catalog_migrations')"
            ),
            {"name": name},
        )
        if exists:
            return
    op.create_foreign_key(
        name, "catalog_migrations", referent_table, [column], ["id"], ondelete=ondelete
    )


def upgrade() -> None:
    # Each statement commits on its own, so the locks the foreign keys take on
    # organizations and products are never held together, nor carried into
    # later migrations in the same run.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.create_table(
                "catalog_migrations",
                sa.Column("organization_id", sa.Uuid(), nullable=False),
                sa.Column(
                    "source_product_ids", postgresql.ARRAY(sa.Uuid()), nullable=False
                ),
                sa.Column("target_product_id", sa.Uuid(), nullable=False),
                sa.Column("status", sa.String(), nullable=False),
                sa.Column("moved_count", sa.Integer(), nullable=False),
                sa.Column("skipped_count", sa.Integer(), nullable=False),
                sa.Column("last_processed_id", sa.Uuid(), nullable=True),
                sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.PrimaryKeyConstraint("id", name=op.f("catalog_migrations_pkey")),
                if_not_exists=True,
            )
            for column in (
                "created_at",
                "deleted_at",
                "organization_id",
                "target_product_id",
            ):
                op.create_index(
                    op.f(f"ix_catalog_migrations_{column}"),
                    "catalog_migrations",
                    [column],
                    unique=False,
                    if_not_exists=True,
                )
            _ensure_foreign_key(
                op.f("catalog_migrations_organization_id_fkey"),
                "organizations",
                "organization_id",
                ondelete="cascade",
            )
            _ensure_foreign_key(
                op.f("catalog_migrations_target_product_id_fkey"),
                "products",
                "target_product_id",
                ondelete="restrict",
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_table("catalog_migrations", if_exists=True)
        finally:
            op.execute("RESET lock_timeout")

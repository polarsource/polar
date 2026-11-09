"""add catalogs and subscription bulk updates

Revision ID: 6124ede244c2
Revises: b862e002ad65
Create Date: 2026-10-21 09:12:00.998696

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6124ede244c2"
down_revision = "b862e002ad65"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def _ensure_foreign_key(
    constraint_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    *,
    ondelete: str,
) -> None:
    if not op.get_context().as_sql:
        exists = op.get_bind().scalar(
            sa.text(
                "SELECT 1 FROM pg_constraint "
                "WHERE conname = :name AND conrelid = to_regclass(:table)"
            ),
            {"name": constraint_name, "table": source_table},
        )
        if exists:
            return
    op.create_foreign_key(
        constraint_name,
        source_table,
        referent_table,
        local_cols,
        remote_cols,
        ondelete=ondelete,
    )


def upgrade() -> None:
    # Run in an autocommit block so each statement commits immediately and never
    # holds ShareRowExclusiveLock on organizations and products simultaneously,
    # nor carries those locks into subsequent migrations in the same run.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.create_table(
                "catalogs",
                sa.Column("organization_id", sa.Uuid(), nullable=False),
                sa.Column("version_hash", sa.String(length=64), nullable=True),
                sa.Column("status", sa.String(), nullable=False),
                sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(
                    ["organization_id"],
                    ["organizations.id"],
                    name=op.f("catalogs_organization_id_fkey"),
                    ondelete="cascade",
                ),
                sa.PrimaryKeyConstraint("id", name=op.f("catalogs_pkey")),
                sa.UniqueConstraint(
                    "organization_id",
                    "version_hash",
                    name=op.f("catalogs_organization_id_version_hash_key"),
                ),
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_catalogs_created_at"),
                "catalogs",
                ["created_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_catalogs_deleted_at"),
                "catalogs",
                ["deleted_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                "ix_catalogs_organization_id_live",
                "catalogs",
                ["organization_id"],
                unique=True,
                postgresql_where=sa.text("status = 'live' AND deleted_at IS NULL"),
                if_not_exists=True,
            )

            op.create_table(
                "catalog_products",
                sa.Column("catalog_id", sa.Uuid(), nullable=False),
                sa.Column("product_id", sa.Uuid(), nullable=False),
                sa.Column("external_id", sa.String(), nullable=False),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(
                    ["catalog_id"],
                    ["catalogs.id"],
                    name=op.f("catalog_products_catalog_id_fkey"),
                    ondelete="cascade",
                ),
                sa.PrimaryKeyConstraint("id", name=op.f("catalog_products_pkey")),
                sa.UniqueConstraint(
                    "catalog_id",
                    "external_id",
                    name=op.f("catalog_products_catalog_id_external_id_key"),
                ),
                sa.UniqueConstraint(
                    "catalog_id",
                    "product_id",
                    name=op.f("catalog_products_catalog_id_product_id_key"),
                ),
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_catalog_products_created_at"),
                "catalog_products",
                ["created_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_catalog_products_deleted_at"),
                "catalog_products",
                ["deleted_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_catalog_products_product_id"),
                "catalog_products",
                ["product_id"],
                unique=False,
                if_not_exists=True,
            )
            _ensure_foreign_key(
                op.f("catalog_products_product_id_fkey"),
                "catalog_products",
                "products",
                ["product_id"],
                ["id"],
                ondelete="restrict",
            )

            op.create_table(
                "subscription_bulk_updates",
                sa.Column("organization_id", sa.Uuid(), nullable=False),
                sa.Column("source_external_id", sa.String(), nullable=False),
                sa.Column("target_product_id", sa.Uuid(), nullable=False),
                sa.Column(
                    "proration_behavior",
                    sa.String(),
                    nullable=False,
                ),
                sa.Column("subscriptions_count", sa.Integer(), nullable=False),
                sa.Column("skipped_count", sa.Integer(), nullable=False),
                sa.Column("last_subscription_id", sa.Uuid(), nullable=True),
                sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("id", sa.Uuid(), nullable=False),
                sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
                sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
                sa.ForeignKeyConstraint(
                    ["organization_id"],
                    ["organizations.id"],
                    name=op.f("subscription_bulk_updates_organization_id_fkey"),
                    ondelete="cascade",
                ),
                sa.PrimaryKeyConstraint(
                    "id", name=op.f("subscription_bulk_updates_pkey")
                ),
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_subscription_bulk_updates_created_at"),
                "subscription_bulk_updates",
                ["created_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_subscription_bulk_updates_deleted_at"),
                "subscription_bulk_updates",
                ["deleted_at"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_subscription_bulk_updates_organization_id"),
                "subscription_bulk_updates",
                ["organization_id"],
                unique=False,
                if_not_exists=True,
            )
            op.create_index(
                op.f("ix_subscription_bulk_updates_target_product_id"),
                "subscription_bulk_updates",
                ["target_product_id"],
                unique=False,
                if_not_exists=True,
            )
            _ensure_foreign_key(
                op.f("subscription_bulk_updates_target_product_id_fkey"),
                "subscription_bulk_updates",
                "products",
                ["target_product_id"],
                ["id"],
                ondelete="restrict",
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.drop_index(
                op.f("ix_subscription_bulk_updates_target_product_id"),
                table_name="subscription_bulk_updates",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_subscription_bulk_updates_organization_id"),
                table_name="subscription_bulk_updates",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_subscription_bulk_updates_deleted_at"),
                table_name="subscription_bulk_updates",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_subscription_bulk_updates_created_at"),
                table_name="subscription_bulk_updates",
                if_exists=True,
            )
            op.drop_table("subscription_bulk_updates", if_exists=True)
            op.drop_index(
                op.f("ix_catalog_products_product_id"),
                table_name="catalog_products",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_catalog_products_deleted_at"),
                table_name="catalog_products",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_catalog_products_created_at"),
                table_name="catalog_products",
                if_exists=True,
            )
            op.drop_table("catalog_products", if_exists=True)
            op.drop_index(
                "ix_catalogs_organization_id_live",
                table_name="catalogs",
                postgresql_where=sa.text("status = 'live' AND deleted_at IS NULL"),
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_catalogs_deleted_at"),
                table_name="catalogs",
                if_exists=True,
            )
            op.drop_index(
                op.f("ix_catalogs_created_at"),
                table_name="catalogs",
                if_exists=True,
            )
            op.drop_table("catalogs", if_exists=True)
        finally:
            op.execute("RESET lock_timeout")

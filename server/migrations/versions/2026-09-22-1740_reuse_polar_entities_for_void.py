"""reuse Polar entities for Void

Revision ID: c350ed635faf
Revises: c3a7f2d81e64
Create Date: 2026-09-22 17:40:50.791902

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c350ed635faf"
down_revision = "c3a7f2d81e64"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_table("void_subscriptions")
    op.drop_table("void_products")
    op.drop_table("void_meters")
    op.drop_table("void_entitlements")
    op.drop_table("void_events")
    op.add_column("benefits", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("benefits", sa.Column("name", sa.String(), nullable=True))
    op.create_unique_constraint(
        op.f("benefits_organization_id_slug_key"),
        "benefits",
        ["organization_id", "slug"],
    )
    op.add_column(
        "events", sa.Column("external_identity_id", sa.String(), nullable=True)
    )
    op.add_column("events", sa.Column("external_root_id", sa.String(), nullable=True))
    op.add_column(
        "events", sa.Column("delivered_at", sa.TIMESTAMP(timezone=True), nullable=True)
    )
    op.alter_column(
        "events",
        "name",
        existing_type=sa.VARCHAR(length=128),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.add_column("meters", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("meters", sa.Column("version_id", sa.String(), nullable=True))
    op.add_column("meters", sa.Column("deployment_id", sa.Uuid(), nullable=True))
    op.add_column("meters", sa.Column("usage_reducer_id", sa.Uuid(), nullable=True))
    op.add_column("meters", sa.Column("credit_reducer_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_meters_credit_reducer_id"),
        "meters",
        ["credit_reducer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_meters_usage_reducer_id"), "meters", ["usage_reducer_id"], unique=False
    )
    op.create_index(
        op.f("ix_meters_version_id"), "meters", ["version_id"], unique=False
    )
    op.create_unique_constraint(
        op.f("meters_organization_id_slug_version_id_key"),
        "meters",
        ["organization_id", "slug", "version_id"],
    )
    op.create_foreign_key(
        op.f("meters_organization_id_usage_reducer_id_fkey"),
        "meters",
        "void_reducers",
        ["organization_id", "usage_reducer_id"],
        ["organization_id", "id"],
    )
    op.create_foreign_key(
        op.f("meters_organization_id_credit_reducer_id_fkey"),
        "meters",
        "void_reducers",
        ["organization_id", "credit_reducer_id"],
        ["organization_id", "id"],
    )
    op.create_foreign_key(
        op.f("meters_deployment_id_fkey"),
        "meters",
        "void_deployments",
        ["deployment_id"],
        ["id"],
    )
    op.add_column("products", sa.Column("slug", sa.String(), nullable=True))
    op.add_column("products", sa.Column("version_id", sa.String(), nullable=True))
    op.add_column(
        "products",
        sa.Column(
            "meter_terms",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.create_index(
        op.f("ix_products_version_id"), "products", ["version_id"], unique=False
    )
    op.create_unique_constraint(
        op.f("products_organization_id_slug_version_id_key"),
        "products",
        ["organization_id", "slug", "version_id"],
    )
    op.add_column(
        "subscriptions", sa.Column("billing_identity_id", sa.Uuid(), nullable=True)
    )
    op.create_index(
        op.f("ix_subscriptions_billing_identity_id"),
        "subscriptions",
        ["billing_identity_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("subscriptions_billing_identity_id_fkey"),
        "subscriptions",
        "void_identities",
        ["billing_identity_id"],
        ["id"],
    )


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("subscriptions_billing_identity_id_fkey"),
        "subscriptions",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_subscriptions_billing_identity_id"), table_name="subscriptions"
    )
    op.drop_column("subscriptions", "billing_identity_id")
    op.drop_constraint(
        op.f("products_organization_id_slug_version_id_key"), "products", type_="unique"
    )
    op.drop_index(op.f("ix_products_version_id"), table_name="products")
    op.drop_column("products", "meter_terms")
    op.drop_column("products", "version_id")
    op.drop_column("products", "slug")
    op.drop_constraint(op.f("meters_deployment_id_fkey"), "meters", type_="foreignkey")
    op.drop_constraint(
        op.f("meters_organization_id_credit_reducer_id_fkey"),
        "meters",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("meters_organization_id_usage_reducer_id_fkey"),
        "meters",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("meters_organization_id_slug_version_id_key"), "meters", type_="unique"
    )
    op.drop_index(op.f("ix_meters_version_id"), table_name="meters")
    op.drop_index(op.f("ix_meters_usage_reducer_id"), table_name="meters")
    op.drop_index(op.f("ix_meters_credit_reducer_id"), table_name="meters")
    op.drop_column("meters", "credit_reducer_id")
    op.drop_column("meters", "usage_reducer_id")
    op.drop_column("meters", "deployment_id")
    op.drop_column("meters", "version_id")
    op.drop_column("meters", "slug")
    op.alter_column(
        "events",
        "name",
        existing_type=sa.String(length=255),
        type_=sa.VARCHAR(length=128),
        existing_nullable=False,
    )
    op.drop_column("events", "delivered_at")
    op.drop_column("events", "external_root_id")
    op.drop_column("events", "external_identity_id")
    op.drop_constraint(
        op.f("benefits_organization_id_slug_key"), "benefits", type_="unique"
    )
    op.drop_column("benefits", "name")
    op.drop_column("benefits", "slug")
    op.create_table(
        "void_entitlements",
        sa.Column("slug", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("description", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_entitlements_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_entitlements_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "slug",
            name=op.f("void_entitlements_organization_id_slug_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
    )
    op.create_index(
        op.f("ix_void_entitlements_organization_id"),
        "void_entitlements",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_entitlements_deleted_at"),
        "void_entitlements",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_entitlements_created_at"),
        "void_entitlements",
        ["created_at"],
        unique=False,
    )
    op.create_table(
        "void_products",
        sa.Column("slug", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("version_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("description", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("price_type", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("interval", sa.VARCHAR(), autoincrement=False, nullable=True),
        sa.Column("interval_count", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column(
            "amount",
            sa.NUMERIC(precision=19, scale=6),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False
        ),
        sa.Column(
            "meter_ids",
            postgresql.ARRAY(sa.UUID()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "meter_terms",
            postgresql.JSONB(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "entitlement_ids",
            postgresql.ARRAY(sa.UUID()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_products_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_products_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "id",
            name=op.f("void_products_organization_id_id_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
        sa.UniqueConstraint(
            "organization_id",
            "slug",
            "version_id",
            name=op.f("void_products_organization_id_slug_version_id_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
    )
    op.create_index(
        op.f("ix_void_products_version_id"),
        "void_products",
        ["version_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_products_organization_id"),
        "void_products",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_products_deleted_at"),
        "void_products",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_products_created_at"),
        "void_products",
        ["created_at"],
        unique=False,
    )
    op.create_table(
        "void_events",
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("external_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column(
            "timestamp",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "delivered_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_events_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_events_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "external_id",
            name=op.f("void_events_organization_id_external_id_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
    )
    op.create_index(
        op.f("ix_void_events_pending_delivery"),
        "void_events",
        ["organization_id", "created_at"],
        unique=False,
        postgresql_where="(delivered_at IS NULL)",
    )
    op.create_index(
        op.f("ix_void_events_organization_id"),
        "void_events",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_events_metadata"),
        "void_events",
        [sa.literal_column("((payload ->> 'metadata'::text)::jsonb)")],
        unique=False,
        postgresql_ops={"((payload ->> 'metadata'::text)::jsonb)": "jsonb_path_ops"},
        postgresql_using="gin",
    )
    op.create_index(
        op.f("ix_void_events_identity_timestamp"),
        "void_events",
        [
            "organization_id",
            sa.literal_column("(payload ->> 'external_identity_id'::text)"),
            "timestamp",
        ],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_events_deleted_at"), "void_events", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_void_events_created_at"), "void_events", ["created_at"], unique=False
    )
    op.create_table(
        "void_meters",
        sa.Column("name", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("slug", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("version_id", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column("usage_reducer_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("credit_reducer_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "unit_amount",
            sa.NUMERIC(precision=17, scale=12),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "currency", sa.VARCHAR(length=3), autoincrement=False, nullable=False
        ),
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "credit_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
            name=op.f("void_meters_organization_id_credit_reducer_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "usage_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
            name=op.f("void_meters_organization_id_usage_reducer_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_meters_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_meters_pkey")),
        sa.UniqueConstraint(
            "organization_id",
            "slug",
            "version_id",
            name=op.f("void_meters_organization_id_slug_version_id_key"),
            postgresql_include=[],
            postgresql_nulls_not_distinct=False,
        ),
    )
    op.create_index(
        op.f("ix_void_meters_version_id"), "void_meters", ["version_id"], unique=False
    )
    op.create_index(
        op.f("ix_void_meters_usage_reducer_id"),
        "void_meters",
        ["usage_reducer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_meters_organization_id"),
        "void_meters",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_meters_deleted_at"), "void_meters", ["deleted_at"], unique=False
    )
    op.create_index(
        op.f("ix_void_meters_credit_reducer_id"),
        "void_meters",
        ["credit_reducer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_meters_created_at"), "void_meters", ["created_at"], unique=False
    )
    op.create_table(
        "void_subscriptions",
        sa.Column("product_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "billing_identity_id", sa.UUID(), autoincrement=False, nullable=False
        ),
        sa.Column("status", sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column(
            "started_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "canceled_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "ends_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column("organization_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "modified_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.Column(
            "deleted_at",
            postgresql.TIMESTAMP(timezone=True),
            autoincrement=False,
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "billing_identity_id"],
            ["void_identities.organization_id", "void_identities.id"],
            name=op.f("void_subscriptions_organization_id_billing_identity_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id", "product_id"],
            ["void_products.organization_id", "void_products.id"],
            name=op.f("void_subscriptions_organization_id_product_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("void_subscriptions_organization_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("void_subscriptions_pkey")),
    )
    op.create_index(
        op.f("ix_void_subscriptions_status"),
        "void_subscriptions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_subscriptions_product_id"),
        "void_subscriptions",
        ["product_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_subscriptions_organization_id"),
        "void_subscriptions",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_subscriptions_deleted_at"),
        "void_subscriptions",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_subscriptions_created_at"),
        "void_subscriptions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_void_subscriptions_billing_identity_id"),
        "void_subscriptions",
        ["billing_identity_id"],
        unique=False,
    )

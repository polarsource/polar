"""Migrate to Customers

Revision ID: e47b6d16d3e0
Revises: 59538121ff3b
Create Date: 2024-12-09 13:57:40.151264

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports
from polar.kit.address import AddressType
from polar.kit.tax import TaxIDType

# revision identifiers, used by Alembic.
revision = "e47b6d16d3e0"
down_revision = "59538121ff3b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###

    # CUSTOMERS
    op.create_table(
        "customers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("email_verified", sa.Boolean(), nullable=False),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("billing_address", AddressType(astext_type=sa.Text()), nullable=True),
        sa.Column("tax_id", TaxIDType(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "oauth_accounts", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("legacy_user_id", sa.Uuid(), nullable=True),
        sa.Column(
            "user_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("customers_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["legacy_user_id"],
            ["users.id"],
            name=op.f("customers_legacy_user_id_fkey"),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("customers_pkey")),
        sa.UniqueConstraint(
            "stripe_customer_id", name=op.f("customers_stripe_customer_id_key")
        ),
    )
    op.create_index(
        op.f("ix_customers_created_at"), "customers", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_customers_deleted_at"), "customers", ["deleted_at"], unique=False
    )
    op.create_index(
        "ix_customers_email_case_insensitive",
        "customers",
        [sa.text("lower(email)")],
        unique=False,
    )
    op.create_index(
        op.f("ix_customers_modified_at"), "customers", ["modified_at"], unique=False
    )
    op.create_index(
        "ix_customers_organization_id_email_case_insensitive",
        "customers",
        ["organization_id", sa.text("lower(email)")],
        unique=True,
    )

    op.create_index(
        op.f("ix_customers_tmp_legacy_user_id_organization_id"),
        "customers",
        ["legacy_user_id", "organization_id"],
        unique=True,
    )

    op.execute(
        """
        INSERT INTO customers (
            id,
            created_at,
            email,
            email_verified,
            stripe_customer_id,
            name,
            billing_address,
            tax_id,
            organization_id,
            oauth_accounts,
            user_metadata,
            legacy_user_id
        )
        SELECT
            uuid_generate_v4(),
            users.created_at,
            users.email,
            users.email_verified,
            NULL,
            NULL,
            NULL,
            NULL,
            distinct_orders.organization_id,
            '{}',
            '{}',
            users.id
        FROM (
            SELECT DISTINCT orders.user_id, products.organization_id
            FROM orders
            JOIN products ON products.id = orders.product_id
        ) AS distinct_orders
        JOIN users ON users.id = distinct_orders.user_id;
        """
    )
    op.execute(
        """
        INSERT INTO customers (
            id,
            created_at,
            email,
            email_verified,
            stripe_customer_id,
            name,
            billing_address,
            tax_id,
            organization_id,
            oauth_accounts,
            user_metadata,
            legacy_user_id
        )
        SELECT
            uuid_generate_v4(),
            users.created_at,
            users.email,
            users.email_verified,
            NULL,
            NULL,
            NULL,
            NULL,
            distinct_subscriptions.organization_id,
            '{}',
            '{}',
            users.id
        FROM (
            SELECT DISTINCT subscriptions.user_id, products.organization_id
            FROM subscriptions
            JOIN products ON products.id = subscriptions.product_id
            WHERE (subscriptions.user_id, products.organization_id) NOT IN (
                SELECT legacy_user_id, organization_id
                FROM customers
            )
        ) AS distinct_subscriptions
        JOIN users ON users.id = distinct_subscriptions.user_id;
        """
    )
    op.execute(
        """
        INSERT INTO customers (
            id,
            created_at,
            email,
            email_verified,
            stripe_customer_id,
            name,
            billing_address,
            tax_id,
            organization_id,
            oauth_accounts,
            user_metadata,
            legacy_user_id
        )
        SELECT
            uuid_generate_v4(),
            users.created_at,
            users.email,
            users.email_verified,
            NULL,
            NULL,
            NULL,
            NULL,
            distinct_benefit_grants.organization_id,
            '{}',
            '{}',
            users.id
        FROM (
            SELECT DISTINCT benefit_grants.user_id, benefits.organization_id
            FROM benefit_grants
            JOIN benefits ON benefits.id = benefit_grants.benefit_id
            WHERE (benefit_grants.user_id, benefits.organization_id) NOT IN (
                SELECT legacy_user_id, organization_id
                FROM customers
            )
        ) AS distinct_benefit_grants
        JOIN users ON users.id = distinct_benefit_grants.user_id;
        """
    )

    op.execute(
        """
        UPDATE customers c
        SET oauth_accounts =
            c.oauth_accounts ||
            (
                SELECT jsonb_object_agg(
                    oa.platform || ':' || oa.account_id,
                    jsonb_build_object(
                        'access_token', oa.access_token,
                        'account_id', oa.account_id,
                        'account_username', oa.account_username,
                        'expires_at', oa.expires_at,
                        'refresh_token', oa.refresh_token,
                        'refresh_token_expires_at', oa.refresh_token_expires_at
                    )
                )
                FROM oauth_accounts oa
                WHERE oa.user_id = c.legacy_user_id
                AND oa.platform IN ('github', 'discord')
            )
        WHERE EXISTS (
            SELECT 1
            FROM oauth_accounts oa
            WHERE oa.user_id = c.legacy_user_id
            AND oa.platform IN ('github', 'discord')
        );
        """
    )

    op.drop_index(
        "ix_customers_tmp_legacy_user_id_organization_id", table_name="customers"
    )

    # CUSTOMER SESSIONS

    op.create_table(
        "customer_sessions",
        sa.Column("token", sa.CHAR(length=64), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("customer_sessions_customer_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("customer_sessions_pkey")),
        sa.UniqueConstraint("token", name=op.f("customer_sessions_token_key")),
    )
    op.create_index(
        op.f("ix_customer_sessions_created_at"),
        "customer_sessions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_sessions_deleted_at"),
        "customer_sessions",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_sessions_expires_at"),
        "customer_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_customer_sessions_modified_at"),
        "customer_sessions",
        ["modified_at"],
        unique=False,
    )

    # USER CUSTOMERS

    op.create_table(
        "user_customers",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("user_customers_customer_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("user_customers_user_id_fkey"),
            ondelete="cascade",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("user_customers_pkey")),
        sa.UniqueConstraint(
            "user_id", "customer_id", name="user_customers_user_id_customer_id_key"
        ),
    )
    op.create_index(
        op.f("ix_user_customers_created_at"),
        "user_customers",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_customers_deleted_at"),
        "user_customers",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_user_customers_modified_at"),
        "user_customers",
        ["modified_at"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO user_customers (
            id,
            created_at,
            user_id,
            customer_id
        )
        SELECT
            uuid_generate_v4(),
            now(),
            customers.legacy_user_id,
            customers.id
        FROM customers
        """
    )

    # BENEFIT GRANTS

    op.add_column("benefit_grants", sa.Column("customer_id", sa.Uuid(), nullable=True))

    op.execute(
        """
        UPDATE benefit_grants
        SET customer_id = customers.id
        FROM customers, benefits
        WHERE benefits.id = benefit_grants.benefit_id
        AND customers.legacy_user_id = benefit_grants.user_id
        AND customers.organization_id = benefits.organization_id
        """
    )

    op.alter_column("benefit_grants", "customer_id", nullable=False)

    op.drop_constraint("benefit_grants_sbu_key", "benefit_grants", type_="unique")
    op.drop_index("ix_benefit_grants_user_id", table_name="benefit_grants")
    op.create_unique_constraint(
        "benefit_grants_sbc_key",
        "benefit_grants",
        ["subscription_id", "customer_id", "benefit_id"],
    )
    op.create_index(
        op.f("ix_benefit_grants_customer_id"),
        "benefit_grants",
        ["customer_id"],
        unique=False,
    )

    op.execute(
        "ALTER TABLE benefit_grants DROP CONSTRAINT IF EXISTS benefit_grants_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE benefit_grants DROP CONSTRAINT IF EXISTS subscription_benefit_grants_user_id_fkey"
    )
    op.create_foreign_key(
        op.f("benefit_grants_customer_id_fkey"),
        "benefit_grants",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="cascade",
    )
    op.drop_column("benefit_grants", "user_id")

    # CHECKOUTS

    op.drop_constraint("checkouts_customer_id_fkey", "checkouts", type_="foreignkey")
    op.execute(
        """
        UPDATE checkouts
        SET customer_id = customers.id
        FROM customers, products
        WHERE customers.legacy_user_id = checkouts.customer_id
        AND products.id = checkouts.product_id
        AND products.organization_id = customers.organization_id
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET customer_id = NULL
        WHERE customer_id NOT IN (SELECT id FROM customers)"""
    )
    op.create_foreign_key(
        op.f("checkouts_customer_id_fkey"),
        "checkouts",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="set null",
    )

    # DOWNLOADABLES

    op.add_column("downloadables", sa.Column("customer_id", sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE downloadables
        SET customer_id = customers.id
        FROM customers, benefits
        WHERE customers.legacy_user_id = downloadables.user_id
        AND benefits.id = downloadables.benefit_id
        AND customers.organization_id = benefits.organization_id
        """
    )
    op.alter_column("downloadables", "customer_id", nullable=False)
    op.drop_constraint(
        "downloadables_user_id_file_id_benefit_id_key", "downloadables", type_="unique"
    )
    op.drop_index("ix_downloadables_user_id", table_name="downloadables")
    op.create_unique_constraint(
        op.f("downloadables_customer_id_file_id_benefit_id_key"),
        "downloadables",
        ["customer_id", "file_id", "benefit_id"],
    )
    op.create_index(
        op.f("ix_downloadables_customer_id"),
        "downloadables",
        ["customer_id"],
        unique=False,
    )
    op.execute(
        "ALTER TABLE downloadables DROP CONSTRAINT IF EXISTS file_permissions_user_id_fkey"
    )
    op.execute(
        "ALTER TABLE downloadables DROP CONSTRAINT IF EXISTS downloadables_user_id_fkey"
    )
    op.create_foreign_key(
        op.f("downloadables_customer_id_fkey"),
        "downloadables",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="cascade",
    )
    op.drop_column("downloadables", "user_id")

    # LICENSE KEYS

    op.add_column("license_keys", sa.Column("customer_id", sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE license_keys
        SET customer_id = customers.id
        FROM customers, benefits
        WHERE customers.legacy_user_id = license_keys.user_id
        AND benefits.id = license_keys.benefit_id
        AND customers.organization_id = benefits.organization_id
        """
    )
    op.alter_column("license_keys", "customer_id", nullable=False)
    op.drop_index("ix_license_keys_user_id", table_name="license_keys")
    op.create_index(
        op.f("ix_license_keys_customer_id"),
        "license_keys",
        ["customer_id"],
        unique=False,
    )
    op.drop_constraint("license_keys_user_id_fkey", "license_keys", type_="foreignkey")
    op.create_foreign_key(
        op.f("license_keys_customer_id_fkey"),
        "license_keys",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="cascade",
    )
    op.drop_column("license_keys", "user_id")

    # ORDERS

    op.add_column("orders", sa.Column("customer_id", sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE orders
        SET customer_id = customers.id
        FROM customers, products
        WHERE customers.legacy_user_id = orders.user_id
        AND products.id = orders.product_id
        AND products.organization_id = customers.organization_id
        """
    )
    op.alter_column("orders", "customer_id", nullable=False)
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS sales_user_id_fkey")
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey")
    op.create_foreign_key(
        op.f("orders_customer_id_fkey"), "orders", "customers", ["customer_id"], ["id"]
    )
    op.drop_column("orders", "user_id")

    # SUBSCRIPTIONS

    op.add_column("subscriptions", sa.Column("customer_id", sa.Uuid(), nullable=True))
    op.execute(
        """
        UPDATE subscriptions
        SET customer_id = customers.id
        FROM customers, products
        WHERE customers.legacy_user_id = subscriptions.user_id
        AND products.id = subscriptions.product_id
        AND products.organization_id = customers.organization_id
        """
    )
    op.alter_column("subscriptions", "customer_id", nullable=False)
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.create_index(
        op.f("ix_subscriptions_customer_id"),
        "subscriptions",
        ["customer_id"],
        unique=False,
    )
    op.drop_constraint(
        "subscriptions_user_id_fkey", "subscriptions", type_="foreignkey"
    )
    op.create_foreign_key(
        op.f("subscriptions_customer_id_fkey"),
        "subscriptions",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="cascade",
    )
    op.drop_column("subscriptions", "user_id")

    # TRANSACTIONS

    op.add_column(
        "transactions", sa.Column("payment_customer_id", sa.Uuid(), nullable=True)
    )
    op.execute(
        """
        UPDATE transactions
        SET payment_customer_id = customers.id
        FROM customers
        WHERE customers.legacy_user_id = transactions.payment_user_id
        """
    )
    op.execute(
        """
        UPDATE transactions
        SET payment_user_id = NULL
        WHERE payment_customer_id IS NOT NULL
        """
    )
    op.create_index(
        op.f("ix_transactions_payment_customer_id"),
        "transactions",
        ["payment_customer_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("transactions_payment_customer_id_fkey"),
        "transactions",
        "customers",
        ["payment_customer_id"],
        ["id"],
        ondelete="set null",
    )

    # BenefitPreconditionErrorNotification
    op.execute(
        """
        DELETE FROM notifications
        WHERE type = 'BenefitPreconditionErrorNotification'
        """
    )

    # License key activations enable_customer_admin flag
    op.execute(
        """
        UPDATE benefits
        SET properties = jsonb_set(properties #- '{activations,enable_user_admin}', '{activations,enable_customer_admin}', properties #> '{activations,enable_user_admin}')
        WHERE type = 'license_keys'
        AND properties #> '{activations}' ? 'enable_user_admin'
        """
    )

    # Replace removed scopes
    op.execute(
        """
        WITH splitted_scope AS (
            SELECT id, regexp_split_to_table(scope, '\\s+') as s
            FROM personal_access_tokens
        ), user_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
        ), has_write_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:subscriptions:write',
                'user:advertisement_campaigns:write'
            )
        ), aggregated_scope AS (
            SELECT user_scope.id,
                string_agg(splitted_scope.s, ' ') AS s,
                EXISTS (SELECT 1 FROM has_write_scope WHERE has_write_scope.id = user_scope.id) as has_write
            FROM splitted_scope
            JOIN user_scope ON splitted_scope.id = user_scope.id
            WHERE splitted_scope.s NOT IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
            GROUP BY user_scope.id
        )
        UPDATE personal_access_tokens
        SET scope = CASE
            WHEN aggregated_scope.has_write
            THEN aggregated_scope.s || ' customer_portal:read customer_portal:write'
            ELSE aggregated_scope.s || ' customer_portal:read'
        END
        FROM aggregated_scope
        WHERE aggregated_scope.id = personal_access_tokens.id;
        """
    )
    op.execute(
        """
        WITH splitted_scope AS (
            SELECT id, regexp_split_to_table(scope, '\\s+') as s
            FROM oauth2_tokens
        ), user_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
        ), has_write_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:subscriptions:write',
                'user:advertisement_campaigns:write'
            )
        ), aggregated_scope AS (
            SELECT user_scope.id,
                string_agg(splitted_scope.s, ' ') AS s,
                EXISTS (SELECT 1 FROM has_write_scope WHERE has_write_scope.id = user_scope.id) as has_write
            FROM splitted_scope
            JOIN user_scope ON splitted_scope.id = user_scope.id
            WHERE splitted_scope.s NOT IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
            GROUP BY user_scope.id
        )
        UPDATE oauth2_tokens
        SET scope = CASE
            WHEN aggregated_scope.has_write
            THEN aggregated_scope.s || ' customer_portal:read customer_portal:write'
            ELSE aggregated_scope.s || ' customer_portal:read'
        END
        FROM aggregated_scope
        WHERE aggregated_scope.id = oauth2_tokens.id;
        """
    )
    op.execute(
        """
        WITH splitted_scope AS (
            SELECT id, regexp_split_to_table(scope, '\\s+') as s
            FROM oauth2_grants
        ), user_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
        ), has_write_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:subscriptions:write',
                'user:advertisement_campaigns:write'
            )
        ), aggregated_scope AS (
            SELECT user_scope.id,
                string_agg(splitted_scope.s, ' ') AS s,
                EXISTS (SELECT 1 FROM has_write_scope WHERE has_write_scope.id = user_scope.id) as has_write
            FROM splitted_scope
            JOIN user_scope ON splitted_scope.id = user_scope.id
            WHERE splitted_scope.s NOT IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
            GROUP BY user_scope.id
        )
        UPDATE oauth2_grants
        SET scope = CASE
            WHEN aggregated_scope.has_write
            THEN aggregated_scope.s || ' customer_portal:read customer_portal:write'
            ELSE aggregated_scope.s || ' customer_portal:read'
        END
        FROM aggregated_scope
        WHERE aggregated_scope.id = oauth2_grants.id;
        """
    )
    op.execute(
        """
        WITH splitted_scope AS (
            SELECT id, regexp_split_to_table((client_metadata::JSONB)->>'scope', '\\s+') as s
            FROM oauth2_clients
        ), user_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
        ), has_write_scope AS (
            SELECT DISTINCT id
            FROM splitted_scope
            WHERE splitted_scope.s IN (
                'user:subscriptions:write',
                'user:advertisement_campaigns:write'
            )
        ), aggregated_scope AS (
            SELECT user_scope.id,
                string_agg(splitted_scope.s, ' ') AS s,
                EXISTS (SELECT 1 FROM has_write_scope WHERE has_write_scope.id = user_scope.id) as has_write
            FROM splitted_scope
            JOIN user_scope ON splitted_scope.id = user_scope.id
            WHERE splitted_scope.s NOT IN (
                'user:benefits:read',
                'user:orders:read',
                'user:subscriptions:read',
                'user:subscriptions:write',
                'user:downloadables:read',
                'user:advertisement_campaigns:read',
                'user:advertisement_campaigns:write',
                'user:license_keys:read'
            )
            GROUP BY user_scope.id
        )
        UPDATE oauth2_clients
        SET client_metadata = jsonb_set(
            client_metadata::jsonb,
            '{scope}',
            to_jsonb(
                CASE
                    WHEN aggregated_scope.has_write
                    THEN aggregated_scope.s || ' customer_portal:read customer_portal:write'
                    ELSE aggregated_scope.s || ' customer_portal:read'
                END
            ),
            true
        )::text
        FROM aggregated_scope
        WHERE aggregated_scope.id = oauth2_clients.id;
        """
    )

    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(
        op.f("transactions_payment_customer_id_fkey"),
        "transactions",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_transactions_payment_customer_id"), table_name="transactions"
    )
    op.drop_column("transactions", "payment_customer_id")
    op.add_column(
        "subscriptions",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(
        op.f("subscriptions_customer_id_fkey"), "subscriptions", type_="foreignkey"
    )
    op.create_foreign_key(
        "subscriptions_user_id_fkey",
        "subscriptions",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_subscriptions_customer_id"), table_name="subscriptions")
    op.create_index(
        "ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False
    )
    op.drop_column("subscriptions", "customer_id")
    op.add_column(
        "orders", sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False)
    )
    op.drop_constraint(op.f("orders_customer_id_fkey"), "orders", type_="foreignkey")
    op.create_foreign_key("orders_user_id_fkey", "orders", "users", ["user_id"], ["id"])
    op.drop_column("orders", "customer_id")
    op.add_column(
        "license_keys",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(
        op.f("license_keys_customer_id_fkey"), "license_keys", type_="foreignkey"
    )
    op.create_foreign_key(
        "license_keys_user_id_fkey",
        "license_keys",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_license_keys_customer_id"), table_name="license_keys")
    op.create_index(
        "ix_license_keys_user_id", "license_keys", ["user_id"], unique=False
    )
    op.drop_column("license_keys", "customer_id")
    op.add_column(
        "downloadables",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(
        op.f("downloadables_customer_id_fkey"), "downloadables", type_="foreignkey"
    )
    op.create_foreign_key(
        "downloadables_user_id_fkey",
        "downloadables",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_downloadables_customer_id"), table_name="downloadables")
    op.drop_constraint(
        op.f("downloadables_customer_id_file_id_benefit_id_key"),
        "downloadables",
        type_="unique",
    )
    op.create_index(
        "ix_downloadables_user_id", "downloadables", ["user_id"], unique=False
    )
    op.create_unique_constraint(
        "downloadables_user_id_file_id_benefit_id_key",
        "downloadables",
        ["user_id", "file_id", "benefit_id"],
    )
    op.drop_column("downloadables", "customer_id")
    op.drop_constraint(
        op.f("checkouts_customer_id_fkey"), "checkouts", type_="foreignkey"
    )
    op.create_foreign_key(
        "checkouts_customer_id_fkey",
        "checkouts",
        "users",
        ["customer_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.add_column(
        "benefit_grants",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
    )
    op.drop_constraint(
        op.f("benefit_grants_customer_id_fkey"), "benefit_grants", type_="foreignkey"
    )
    op.create_foreign_key(
        "benefit_grants_user_id_fkey",
        "benefit_grants",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_index(op.f("ix_benefit_grants_customer_id"), table_name="benefit_grants")
    op.drop_constraint("benefit_grants_sbc_key", "benefit_grants", type_="unique")
    op.create_index(
        "ix_benefit_grants_user_id", "benefit_grants", ["user_id"], unique=False
    )
    op.create_unique_constraint(
        "benefit_grants_sbu_key",
        "benefit_grants",
        ["subscription_id", "user_id", "benefit_id"],
    )
    op.drop_column("benefit_grants", "customer_id")
    op.drop_index(op.f("ix_user_customers_modified_at"), table_name="user_customers")
    op.drop_index(op.f("ix_user_customers_deleted_at"), table_name="user_customers")
    op.drop_index(op.f("ix_user_customers_created_at"), table_name="user_customers")
    op.drop_table("user_customers")
    op.drop_index(
        op.f("ix_customer_sessions_modified_at"), table_name="customer_sessions"
    )
    op.drop_index(
        op.f("ix_customer_sessions_expires_at"), table_name="customer_sessions"
    )
    op.drop_index(
        op.f("ix_customer_sessions_deleted_at"), table_name="customer_sessions"
    )
    op.drop_index(
        op.f("ix_customer_sessions_created_at"), table_name="customer_sessions"
    )
    op.drop_table("customer_sessions")
    op.drop_index(
        "ix_customers_organization_id_email_case_insensitive", table_name="customers"
    )
    op.drop_index(op.f("ix_customers_modified_at"), table_name="customers")
    op.drop_index("ix_customers_email_case_insensitive", table_name="customers")
    op.drop_index(op.f("ix_customers_deleted_at"), table_name="customers")
    op.drop_index(op.f("ix_customers_created_at"), table_name="customers")
    op.drop_table("customers")
    # ### end Alembic commands ###

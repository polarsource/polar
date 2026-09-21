"""index expires_at for delete_expired crons

Revision ID: 1a1d29060b39
Revises: 8aa7e7e94a61
Create Date: 2026-09-21 08:59:59.982095

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1a1d29060b39"
down_revision = "8aa7e7e94a61"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


OAUTH2_TOKENS_WHERE = sa.text("refresh_token IS NULL OR refresh_token_revoked_at != 0")

INDEXES: tuple[
    tuple[str, str, list[str | sa.ColumnElement[sa.Boolean]], sa.TextClause | None], ...
] = (
    (
        "ix_authentication_sessions_expires_at",
        "authentication_sessions",
        ["expires_at"],
        None,
    ),
    (
        "ix_customer_email_verifications_expires_at",
        "customer_email_verifications",
        ["expires_at"],
        None,
    ),
    (
        "ix_email_verification_expires_at",
        "email_verification",
        ["expires_at"],
        None,
    ),
    (
        "ix_oauth2_tokens_expires_at",
        "oauth2_tokens",
        [sa.literal_column("(issued_at + expires_in)")],
        OAUTH2_TOKENS_WHERE,
    ),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, columns, where in INDEXES:
                # Recover an invalid index left by an interrupted concurrent build.
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
                op.create_index(
                    name,
                    table,
                    columns,
                    unique=False,
                    postgresql_where=where,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            for name, table, _, _ in INDEXES:
                op.drop_index(
                    name,
                    table_name=table,
                    if_exists=True,
                    postgresql_concurrently=True,
                )
        finally:
            op.execute("RESET lock_timeout")

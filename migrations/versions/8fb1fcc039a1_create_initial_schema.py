"""create initial schema

Revision ID: 8fb1fcc039a1
Revises: 
Create Date: 2023-01-26 23:01:23.923123

The standard names for indexes in PostgreSQL are:

{tablename}_{columnname(s)}_{suffix}

Suffixes:
    pkey - Primary Key constraint
    key - Unique constraint
    excl - Exclusion constraint
    fkey - Foreign key
    check - Check constraint
    idx - Any other

See:
https://stackoverflow.com/questions/4107915/postgresql-default-constraint-names/4108266#4108266
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from polar.ext.sqlalchemy import GUID

# revision identifiers, used by Alembic.
revision: str = "8fb1fcc039a1"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def create_demo() -> None:
    op.create_table(
        "demo",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=True),
        sa.Column("id", sa.UUID, nullable=False, primary_key=True),
        sa.Column("testing", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def drop_demo() -> None:
    op.drop_table("demo")


def create_users() -> None:
    op.create_table(
        "users",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(length=1024), nullable=False),
        sa.Column("profile", postgresql.JSONB(), server_default="{}"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("is_superuser", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.PrimaryKeyConstraint("id"),
    )


def drop_users() -> None:
    op.drop_table("users")


def create_oauth_accounts() -> None:
    op.create_table(
        "oauth_accounts",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("modified_at", sa.DateTime(), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("oauth_name", sa.String(length=100), nullable=False),
        sa.Column("access_token", sa.String(length=1024), nullable=False),
        sa.Column("expires_at", sa.Integer, nullable=True),
        sa.Column("refresh_token", sa.String(length=1024), nullable=True),
        sa.Column("account_id", sa.String(length=320), nullable=False),
        sa.Column("account_email", sa.String(length=320), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    op.create_index("oauth_accounts_oauth_namex", "oauth_accounts", ["oauth_name"])
    op.create_index("oauth_accounts_account_idx", "oauth_accounts", ["account_id"])


def drop_oauth_accounts() -> None:
    op.drop_table("oauth_accounts")
    op.drop_index("oauth_accounts_oauth_namex")
    op.drop_index("oauth_accounts_oauth_account_idx")


def upgrade() -> None:
    create_demo()
    create_users()
    create_oauth_accounts()


def downgrade() -> None:
    drop_demo()
    drop_users()
    drop_oauth_accounts()

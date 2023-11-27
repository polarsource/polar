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
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from polar.kit.extensions.sqlalchemy import GUID

# revision identifiers, used by Alembic.
revision: str = "8fb1fcc039a1"
down_revision: str | None = None
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def create_users() -> None:
    op.create_table(
        "users",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
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


def create_organizations() -> None:
    op.create_table(
        "organizations",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("external_id", sa.Integer, nullable=False, unique=True),
        sa.Column("avatar_url", sa.String, nullable=True),
        sa.Column("is_personal", sa.Boolean, nullable=False),
        sa.Column("is_site_admin", sa.Boolean, nullable=False),
        sa.Column("installation_id", sa.Integer, nullable=False, unique=True),
        sa.Column(
            "installation_created_at", sa.TIMESTAMP(timezone=True), nullable=False
        ),
        sa.Column(
            "installation_updated_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column(
            "installation_suspended_at", sa.TIMESTAMP(timezone=True), nullable=True
        ),
        sa.Column("installation_suspended_by", sa.Integer, nullable=True),
        sa.Column("installation_suspender", GUID(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="inactive"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("installation_id"),
        sa.PrimaryKeyConstraint("id"),
    )


def drop_organizations() -> None:
    op.drop_table("organizations")


def create_user_organizations() -> None:
    op.create_table(
        "user_organizations",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("organization_id", GUID(), nullable=False),
        sa.Column("status", sa.Integer, nullable=False, default=0),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "organization_id"),
    )


def drop_user_organizations() -> None:
    op.drop_table("user_organizations")


def create_accounts() -> None:
    op.create_table(
        "accounts",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("organization_id", GUID(), unique=True),
        sa.Column("user_id", GUID(), unique=True),
        sa.Column("stripe_id", sa.String(100), nullable=False, unique=True),
        sa.Column("is_personal", sa.Boolean, nullable=False),
        sa.Column("email", sa.String(254), unique=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("is_details_submitted", sa.Boolean, nullable=False),
        sa.Column("is_charges_enabled", sa.Boolean, nullable=False),
        sa.Column("is_payouts_enabled", sa.Boolean, nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="created"),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("organization_id"),
        sa.UniqueConstraint("user_id"),
        sa.UniqueConstraint("stripe_id"),
    )


def drop_accounts() -> None:
    op.drop_table("accounts")


def create_repositories() -> None:
    op.create_table(
        "repositories",
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", GUID(), nullable=False, primary_key=True),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("external_id", sa.Integer, nullable=False, unique=True),
        sa.Column("organization_id", GUID(), nullable=True),
        sa.Column("organization_name", sa.String, nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String(256), nullable=True),
        sa.Column("open_issues", sa.Integer, nullable=True),
        sa.Column("forks", sa.Integer, nullable=True),
        sa.Column("stars", sa.Integer, nullable=True),
        sa.Column("watchers", sa.Integer, nullable=True),
        sa.Column("main_branch", sa.String, nullable=True),
        sa.Column("topics", postgresql.JSONB(), nullable=True),
        sa.Column("license", sa.String(50), nullable=True),
        sa.Column("repository_pushed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("repository_created_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("repository_modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_private", sa.Boolean, nullable=False),
        sa.Column("is_fork", sa.Boolean, nullable=True),
        sa.Column("is_issues_enabled", sa.Boolean, nullable=True),
        sa.Column("is_projects_enabled", sa.Boolean, nullable=True),
        sa.Column("is_wiki_enabled", sa.Boolean, nullable=True),
        sa.Column("is_pages_enabled", sa.Boolean, nullable=True),
        sa.Column("is_downloads_enabled", sa.Boolean, nullable=True),
        sa.Column("is_archived", sa.Boolean, nullable=True),
        sa.Column("is_disabled", sa.Boolean, nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("organization_name", "name"),
    )


def drop_repositories() -> None:
    op.drop_table("repositories")


def get_base_issue_columns() -> list[sa.Column[Any]]:
    columns = [
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("id", GUID, nullable=False, primary_key=True),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("external_id", sa.Integer, nullable=False),
        sa.Column("organization_id", GUID, nullable=True),
        sa.Column("organization_name", sa.String, nullable=False),
        sa.Column("repository_id", GUID, nullable=True),
        sa.Column("repository_name", sa.String, nullable=False),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, nullable=True),
        sa.Column("comments", sa.Integer, nullable=True),
        sa.Column("author", postgresql.JSONB, nullable=True),
        sa.Column("author_association", sa.String, nullable=True),
        sa.Column("labels", postgresql.JSONB, nullable=True),
        sa.Column("assignee", postgresql.JSONB, nullable=True),
        sa.Column("assignees", postgresql.JSONB, nullable=True),
        sa.Column("milestone", postgresql.JSONB, nullable=True),
        sa.Column("closed_by", postgresql.JSONB, nullable=True),
        sa.Column("reactions", postgresql.JSONB, nullable=True),
        sa.Column("state", sa.String(30), nullable=False),
        sa.Column("state_reason", sa.String, nullable=True),
        sa.Column("is_locked", sa.Boolean, nullable=False),
        sa.Column("lock_reason", sa.String, nullable=True),
        sa.Column("issue_closed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("issue_created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("issue_modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
    ]
    return columns  # type: ignore


def create_issues() -> None:
    op.create_table(
        "issues",
        *get_base_issue_columns(),
        sa.Column("token", sa.String, nullable=False, unique=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["repository_id"], ["repositories.id"]),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("organization_name", "repository_name", "number"),
        sa.UniqueConstraint("token"),
    )


def drop_issues() -> None:
    op.drop_table("issues")


def create_pull_requests() -> None:
    op.create_table(
        "pull_requests",
        *get_base_issue_columns(),
        sa.Column("commits", sa.Integer, nullable=True),
        sa.Column("additions", sa.Integer, nullable=True),
        sa.Column("deletions", sa.Integer, nullable=True),
        sa.Column("changed_files", sa.Integer, nullable=True),
        sa.Column("requested_reviewers", postgresql.JSONB, nullable=True),
        sa.Column("requested_teams", postgresql.JSONB, nullable=True),
        sa.Column("is_draft", sa.Boolean, nullable=False),
        sa.Column("is_rebaseable", sa.Boolean, nullable=True),
        sa.Column("review_comments", sa.Integer, nullable=True),
        sa.Column("maintainer_can_modify", sa.Boolean, nullable=True),
        sa.Column("is_mergeable", sa.Boolean, nullable=True),
        sa.Column("mergeable_state", sa.String, nullable=True),
        sa.Column("auto_merge", sa.String, nullable=True),
        sa.Column("is_merged", sa.Boolean, nullable=True),
        sa.Column("merged_by", postgresql.JSONB, nullable=True),
        sa.Column("merged_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("merge_commit_sha", sa.String, nullable=True),
        sa.Column("head", postgresql.JSONB, nullable=True),
        sa.Column("base", postgresql.JSONB, nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["repository_id"], ["repositories.id"]),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("organization_name", "repository_name", "number"),
    )


def drop_pull_requests() -> None:
    op.drop_table("pull_requests")


def upgrade() -> None:
    create_users()
    create_oauth_accounts()
    create_organizations()
    create_user_organizations()
    create_accounts()
    create_repositories()
    create_issues()
    create_pull_requests()


def downgrade() -> None:
    drop_users()
    drop_oauth_accounts()
    drop_user_organizations()
    drop_organizations()
    drop_accounts()
    drop_repositories()
    drop_issues()
    drop_pull_requests()

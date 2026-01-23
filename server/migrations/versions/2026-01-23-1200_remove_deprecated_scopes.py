"""Remove deprecated scopes from existing tokens

Revision ID: a1b2c3d4e5f6
Revises: 81cb97134c21
Create Date: 2026-01-23 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "224f63e13193"
down_revision = "81cb97134c21"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

DEPRECATED_SCOPES = [
    "external_organizations:read",
    "issues:read",
    "issues:write",
    "repositories:read",
    "repositories:write",
]


def upgrade() -> None:
    for scope in DEPRECATED_SCOPES:
        # Personal access tokens
        op.execute(
            f"UPDATE personal_access_tokens SET scope = REPLACE(scope, '{scope}', '') WHERE scope LIKE '%{scope}%'"
        )

        # Organization access tokens
        op.execute(
            f"UPDATE organization_access_tokens SET scope = REPLACE(scope, '{scope}', '') WHERE scope LIKE '%{scope}%'"
        )

        # OAuth2 tokens
        op.execute(
            f"UPDATE oauth2_tokens SET scope = REPLACE(scope, '{scope}', '') WHERE scope LIKE '%{scope}%'"
        )

        # OAuth2 grants
        op.execute(
            f"UPDATE oauth2_grants SET scope = REPLACE(scope, '{scope}', '') WHERE scope LIKE '%{scope}%'"
        )

        # OAuth2 clients metadata
        op.execute(
            f"UPDATE oauth2_clients SET client_metadata = REPLACE(client_metadata, '{scope}', '') WHERE client_metadata LIKE '%{scope}%'"
        )


def downgrade() -> None:
    # Cannot restore scopes - we don't know which tokens had them
    pass

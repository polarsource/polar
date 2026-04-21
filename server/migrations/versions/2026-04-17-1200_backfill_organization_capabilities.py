"""Backfill organization capabilities and make NOT NULL

Revision ID: 9069283c8add
Revises: 346767c5c3fd
Create Date: 2026-04-17 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "9069283c8add"
down_revision = "346767c5c3fd"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


# Mirror of polar.models.organization.STATUS_CAPABILITIES — keep in sync.
_STATUS_DEFAULTS: dict[str, str] = {
    "created": (
        '{"checkout_payments": false, "subscription_renewals": false, '
        '"payouts": false, "refunds": false, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "review": (
        '{"checkout_payments": true, "subscription_renewals": true, '
        '"payouts": false, "refunds": true, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "snoozed": (
        '{"checkout_payments": true, "subscription_renewals": true, '
        '"payouts": false, "refunds": true, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "active": (
        '{"checkout_payments": true, "subscription_renewals": true, '
        '"payouts": true, "refunds": true, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "denied": (
        '{"checkout_payments": false, "subscription_renewals": false, '
        '"payouts": false, "refunds": false, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "offboarding": (
        '{"checkout_payments": true, "subscription_renewals": true, '
        '"payouts": false, "refunds": true, "api_access": true, '
        '"dashboard_access": true}'
    ),
    "blocked": (
        '{"checkout_payments": false, "subscription_renewals": false, '
        '"payouts": false, "refunds": false, "api_access": false, '
        '"dashboard_access": false}'
    ),
}


def upgrade() -> None:
    # Backfill capabilities from current status. Existing rows wrote NULL
    # because PR1 added the column as nullable without a server default.
    case_sql = (
        "CASE status\n"
        + "\n".join(
            f"    WHEN '{status}' THEN '{value}'::jsonb"
            for status, value in _STATUS_DEFAULTS.items()
        )
        + "\n    END"
    )
    op.execute(
        f"UPDATE organizations SET capabilities = {case_sql} WHERE capabilities IS NULL"
    )

    # Mirror current refunds_blocked overrides into the capability so
    # backoffice flips applied before this migration are preserved.
    op.execute(
        "UPDATE organizations "
        "SET capabilities = jsonb_set(capabilities, '{refunds}', 'false'::jsonb) "
        "WHERE refunds_blocked = true"
    )

    op.alter_column("organizations", "capabilities", nullable=False)


def downgrade() -> None:
    op.alter_column("organizations", "capabilities", nullable=True)

"""Fixtures for post-purchase E2E tests."""

import pytest

from polar.auth.scope import Scope
from tests.fixtures.auth import AuthSubjectFixture

# Auth preset with seat management scopes (extends the purchase scopes).
E2E_SEAT_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.web_read,
            Scope.web_write,
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.customer_seats_read,
            Scope.customer_seats_write,
        },
    )
)

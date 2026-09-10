from typing import Any, Literal

import pytest
from sqlalchemy.dialects.postgresql.asyncpg import PGDialect_asyncpg
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy.engine import make_url

from polar.config import settings


def build_dsn(
    driver: Literal["asyncpg", "psycopg2"],
    *,
    fallback_host: str | None = "fallback.example.com",
    fallback_port: int | None = 5432,
) -> str:
    return settings._build_postgres_dsn(
        driver,
        username="polar",
        password="s3cret",
        host="primary.example.com",
        port=6432,
        database="polar",
        fallback_host=fallback_host,
        fallback_port=fallback_port,
    )


def get_connect_args(dsn: str) -> dict[str, Any]:
    url = make_url(dsn)
    dialect = (
        PGDialect_asyncpg()
        if url.drivername.endswith("asyncpg")
        else PGDialect_psycopg2()
    )
    _, connect_args = dialect.create_connect_args(url)
    return connect_args


class TestBuildPostgresDsn:
    def test_no_fallback(self) -> None:
        dsn = build_dsn("asyncpg", fallback_host=None, fallback_port=None)

        assert dsn == "postgresql+asyncpg://polar:s3cret@primary.example.com:6432/polar"

    @pytest.mark.parametrize(
        "password",
        ["abc/123XYZ", "p@ss/w0rd"],
    )
    @pytest.mark.parametrize("driver", ["asyncpg", "psycopg2"])
    def test_no_fallback_password_with_reserved_chars(
        self, driver: Literal["asyncpg", "psycopg2"], password: str
    ) -> None:
        dsn = settings._build_postgres_dsn(
            driver,
            username="polar",
            password=password,
            host="primary.example.com",
            port=6432,
            database="polar",
            fallback_host=None,
            fallback_port=None,
        )
        connect_args = get_connect_args(dsn)

        assert connect_args["password"] == password
        assert connect_args["host"] == "primary.example.com"
        database_key = "database" if driver == "asyncpg" else "dbname"
        assert connect_args[database_key] == "polar"

    def test_fallback_asyncpg(self) -> None:
        connect_args = get_connect_args(build_dsn("asyncpg"))

        assert connect_args["host"] == ["primary.example.com", "fallback.example.com"]
        assert connect_args["port"] == [6432, 5432]
        assert connect_args["password"] == "s3cret"

    def test_fallback_psycopg2(self) -> None:
        connect_args = get_connect_args(build_dsn("psycopg2"))

        assert connect_args["host"] == "primary.example.com,fallback.example.com"
        assert connect_args["port"] == "6432,5432"
        assert connect_args["password"] == "s3cret"

    def test_fallback_port_defaults_to_primary_port(self) -> None:
        connect_args = get_connect_args(build_dsn("asyncpg", fallback_port=None))

        assert connect_args["port"] == [6432, 6432]


class TestGetCustomerPortalUrlOverride:
    def test_no_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(settings, "CUSTOMER_PORTAL_URL_OVERRIDES", {})

        assert settings.get_customer_portal_url_override("org_id", "product_id") is None

    def test_organization_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            settings,
            "CUSTOMER_PORTAL_URL_OVERRIDES",
            {"org_id": "https://example.com/portal"},
        )

        assert (
            settings.get_customer_portal_url_override("org_id", "product_id")
            == "https://example.com/portal"
        )

    def test_product_override(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            settings,
            "CUSTOMER_PORTAL_URL_OVERRIDES",
            {"org_id": {"product_id": "https://example.com/product-portal"}},
        )

        assert (
            settings.get_customer_portal_url_override("org_id", "product_id")
            == "https://example.com/product-portal"
        )

    def test_product_not_in_organization_override(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            settings,
            "CUSTOMER_PORTAL_URL_OVERRIDES",
            {"org_id": {"product_id": "https://example.com/product-portal"}},
        )

        assert (
            settings.get_customer_portal_url_override("org_id", "other_product_id")
            is None
        )

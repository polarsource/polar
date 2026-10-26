import pytest
from pytest_mock import MockerFixture

from polar.config import Settings, settings
from polar.postgres import create_async_engine, create_async_read_engine


class TestAsyncStatementCaches:
    @pytest.mark.parametrize("read_replica", [False, True])
    @pytest.mark.parametrize("cache_sizes", [None, (0, 0), (25, 50)])
    def test_connect_args(
        self,
        mocker: MockerFixture,
        monkeypatch: pytest.MonkeyPatch,
        read_replica: bool,
        cache_sizes: tuple[int, int] | None,
    ) -> None:
        if cache_sizes is not None:
            monkeypatch.setenv(
                "POLAR_DATABASE_STATEMENT_CACHE_SIZE", str(cache_sizes[0])
            )
            monkeypatch.setenv(
                "POLAR_DATABASE_PREPARED_STATEMENT_CACHE_SIZE", str(cache_sizes[1])
            )
        config = Settings()
        monkeypatch.setattr(
            settings,
            "DATABASE_STATEMENT_CACHE_SIZE",
            config.DATABASE_STATEMENT_CACHE_SIZE,
        )
        monkeypatch.setattr(
            settings,
            "DATABASE_PREPARED_STATEMENT_CACHE_SIZE",
            config.DATABASE_PREPARED_STATEMENT_CACHE_SIZE,
        )
        create_engine = mocker.patch("polar.kit.db.postgres._create_async_engine")

        factory = create_async_read_engine if read_replica else create_async_engine
        factory("app")

        connect_args = create_engine.call_args.kwargs["connect_args"]
        assert connect_args["statement_cache_size"] == (cache_sizes or (100, 0))[0]
        assert (
            connect_args["prepared_statement_cache_size"]
            == (cache_sizes or (100, 0))[1]
        )

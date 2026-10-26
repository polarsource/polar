from unittest.mock import Mock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine as sqlalchemy_create_engine
from sqlalchemy import text

from polar.kit.db.postgres import create_sync_engine


class TestCreateSyncEngine:
    @pytest.mark.parametrize("command_timeout", [None, 0, 1.25, 30.0])
    def test_connect_args(
        self, mocker: MockerFixture, command_timeout: float | None
    ) -> None:
        engine = sqlalchemy_create_engine("sqlite://")
        create_engine = mocker.patch(
            "polar.kit.db.postgres._create_engine", return_value=engine
        )

        assert (
            create_sync_engine(
                dsn="postgresql+psycopg2://localhost/test",
                application_name="test.scheduler",
                command_timeout=command_timeout,
                connect_timeout=5.0,
                sslmode="require",
            )
            is engine
        )
        assert create_engine.call_args.kwargs["connect_args"] == {
            "application_name": "test.scheduler",
            "connect_timeout": 5,
            "sslmode": "require",
        }
        engine.dispose()

    @pytest.mark.parametrize(
        ("command_timeout", "expected_statement"),
        [
            (None, None),
            (0, "SET LOCAL statement_timeout = 0"),
            (1.25, "SET LOCAL statement_timeout = 1250"),
            (30.0, "SET LOCAL statement_timeout = 30000"),
        ],
    )
    def test_timeout_is_set_for_each_transaction(
        self,
        mocker: MockerFixture,
        command_timeout: float | None,
        expected_statement: str | None,
    ) -> None:
        engine = sqlalchemy_create_engine("sqlite://")
        mocker.patch("polar.kit.db.postgres._create_engine", return_value=engine)
        create_sync_engine(
            dsn="postgresql+psycopg2://localhost/test",
            command_timeout=command_timeout,
        )

        def assert_timeout(execute: Mock) -> None:
            if expected_statement is None:
                execute.assert_not_called()
            else:
                execute.assert_called_once_with(expected_statement)
            execute.reset_mock()

        with engine.connect() as connection:
            execute = mocker.patch.object(connection, "exec_driver_sql")
            connection.begin()
            assert_timeout(execute)
            connection.commit()
            connection.begin()
            assert_timeout(execute)
            connection.rollback()
            # Executing without an explicit begin also starts a transaction.
            connection.execute(text("SELECT 1"))
            assert_timeout(execute)
            connection.rollback()

        with engine.connect() as connection:
            execute = mocker.patch.object(connection, "exec_driver_sql")
            with connection.begin():
                assert_timeout(execute)

        engine.dispose()

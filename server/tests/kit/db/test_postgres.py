from pytest_mock import MockerFixture
from sqlalchemy import create_engine as sqlalchemy_create_engine

from polar.kit.db.postgres import create_sync_engine


class TestCreateSyncEngine:
    def test_connect_args(self, mocker: MockerFixture) -> None:
        engine = sqlalchemy_create_engine("sqlite://")
        create_engine = mocker.patch(
            "polar.kit.db.postgres._create_engine", return_value=engine
        )

        assert (
            create_sync_engine(
                dsn="postgresql+psycopg://localhost/test",
                application_name="test.scheduler",
                connect_timeout=5.0,
                sslmode="require",
            )
            is engine
        )
        assert create_engine.call_args.kwargs["connect_args"] == {
            "prepare_threshold": None,
            "application_name": "test.scheduler",
            "connect_timeout": 5,
            "sslmode": "require",
        }
        engine.dispose()

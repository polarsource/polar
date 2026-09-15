from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.kit.aws import get_credentials


def test_development_uses_static_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.development)

    assert get_credentials(endpoint_url=None) == (
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )


def test_testing_uses_static_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.testing)

    assert get_credentials(endpoint_url=None) == (
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )


def test_endpoint_url_uses_static_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)

    assert get_credentials(endpoint_url="http://127.0.0.1:9000") == (
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )


def test_production_uses_default_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)

    assert get_credentials(endpoint_url=None) == (None, None)


def test_sandbox_uses_default_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.sandbox)

    assert get_credentials(endpoint_url=None) == (None, None)


def test_test_environment_uses_default_credential_chain(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "ENV", Environment.test)

    assert get_credentials(endpoint_url=None) == (None, None)

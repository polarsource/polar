from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.kit.aws import get_credentials


def test_development_uses_static_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.development)

    assert get_credentials() == (
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )


def test_testing_uses_static_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.testing)

    assert get_credentials() == (
        settings.AWS_ACCESS_KEY_ID,
        settings.AWS_SECRET_ACCESS_KEY,
    )


def test_production_uses_default_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)

    assert get_credentials() == (None, None)


def test_sandbox_uses_default_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.sandbox)

    assert get_credentials() == (None, None)


def test_test_environment_uses_default_credential_chain(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "ENV", Environment.test)

    assert get_credentials() == (None, None)

from typing import Any

from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.worker import _sqs


def get_boto3_client_kwargs(mocker: MockerFixture) -> dict[str, Any]:
    boto3_client = mocker.patch("polar.worker._sqs.boto3.client")

    _sqs.get_sqs_client()

    boto3_client.assert_called_once()
    return dict(boto3_client.call_args.kwargs)


def test_development_uses_static_aws_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.development)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_ACCESS_KEY_ID", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_SECRET_ACCESS_KEY", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == settings.AWS_ACCESS_KEY_ID
    assert kwargs["aws_secret_access_key"] == settings.AWS_SECRET_ACCESS_KEY


def test_testing_uses_static_aws_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.testing)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_ACCESS_KEY_ID", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_SECRET_ACCESS_KEY", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == settings.AWS_ACCESS_KEY_ID
    assert kwargs["aws_secret_access_key"] == settings.AWS_SECRET_ACCESS_KEY


def test_production_uses_default_aws_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_ACCESS_KEY_ID", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_SECRET_ACCESS_KEY", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] is None
    assert kwargs["aws_secret_access_key"] is None


def test_sqs_endpoint_url_uses_static_aws_credentials(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", "http://127.0.0.1:4566")
    mocker.patch.object(settings, "WORKER_SQS_AWS_ACCESS_KEY_ID", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_SECRET_ACCESS_KEY", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == settings.AWS_ACCESS_KEY_ID
    assert kwargs["aws_secret_access_key"] == settings.AWS_SECRET_ACCESS_KEY


def test_explicit_worker_sqs_credentials_win(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.development)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)
    mocker.patch.object(settings, "WORKER_SQS_AWS_ACCESS_KEY_ID", "worker-access-key")
    mocker.patch.object(
        settings, "WORKER_SQS_AWS_SECRET_ACCESS_KEY", "worker-secret-key"
    )

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == "worker-access-key"
    assert kwargs["aws_secret_access_key"] == "worker-secret-key"

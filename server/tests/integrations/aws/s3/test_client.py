from typing import Any

from pytest_mock import MockerFixture

from polar.config import Environment, settings
from polar.integrations.aws.s3 import client


def get_boto3_client_kwargs(
    mocker: MockerFixture, *, endpoint_url: str | None
) -> dict[str, Any]:
    boto3_client = mocker.patch("polar.integrations.aws.s3.client.boto3.client")

    client.get_client(endpoint_url=endpoint_url)

    boto3_client.assert_called_once()
    return dict(boto3_client.call_args.kwargs)


def test_production_uses_default_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)

    kwargs = get_boto3_client_kwargs(mocker, endpoint_url=None)

    assert kwargs["aws_access_key_id"] is None
    assert kwargs["aws_secret_access_key"] is None


def test_endpoint_url_does_not_select_static_credentials(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)

    kwargs = get_boto3_client_kwargs(mocker, endpoint_url="http://127.0.0.1:9000")

    assert kwargs["aws_access_key_id"] is None
    assert kwargs["aws_secret_access_key"] is None

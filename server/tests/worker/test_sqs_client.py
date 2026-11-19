from typing import Any

import pytest
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

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == settings.AWS_ACCESS_KEY_ID
    assert kwargs["aws_secret_access_key"] == settings.AWS_SECRET_ACCESS_KEY


def test_testing_uses_static_aws_credentials(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.testing)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] == settings.AWS_ACCESS_KEY_ID
    assert kwargs["aws_secret_access_key"] == settings.AWS_SECRET_ACCESS_KEY


def test_production_uses_default_aws_credential_chain(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", None)

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] is None
    assert kwargs["aws_secret_access_key"] is None


def test_sqs_endpoint_url_does_not_select_static_aws_credentials(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(settings, "ENV", Environment.production)
    mocker.patch.object(settings, "SQS_ENDPOINT_URL", "http://127.0.0.1:4566")

    kwargs = get_boto3_client_kwargs(mocker)

    assert kwargs["aws_access_key_id"] is None
    assert kwargs["aws_secret_access_key"] is None


@pytest.mark.anyio
async def test_send_jobs_reuses_client_and_queue_url(mocker: MockerFixture) -> None:
    queue_url = "https://sqs.example.com/polar-test-tasks-default"
    client = mocker.patch("polar.worker._sqs.sqs_client")
    client.get_queue_url.return_value = {"QueueUrl": queue_url}
    client.send_message_batch.return_value = {}
    mocker.patch("polar.worker._sqs._queue_url_cache", {})
    mocker.patch(
        "polar.worker._sqs.actor_to_queue_name", return_value="polar-test-tasks-default"
    )

    jobs = [_sqs.Job("dummy", (), {})]
    await _sqs.send_jobs(jobs)
    await _sqs.send_jobs(jobs)

    client.get_queue_url.assert_called_once_with(QueueName="polar-test-tasks-default")
    assert client.send_message_batch.call_args_list == [
        mocker.call(QueueUrl=queue_url, Entries=mocker.ANY),
        mocker.call(QueueUrl=queue_url, Entries=mocker.ANY),
    ]

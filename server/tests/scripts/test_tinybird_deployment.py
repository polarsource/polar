import json
import subprocess
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
import respx
from pytest_mock import MockerFixture

from scripts import tinybird_test_workspace as workspace

HOST = "http://tinybird.test:7181"
TOKEN = "workspace-secret"


@pytest.fixture
def submitted(mocker: MockerFixture) -> Mock:
    return mocker.patch.object(
        workspace.subprocess,
        "run",
        return_value=subprocess.CompletedProcess([], 0, '{"id": 7}', ""),
    )


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    state = SimpleNamespace(now=0.0, sleeps=[])

    def sleep(seconds: float) -> None:
        state.sleeps.append(seconds)
        state.now += seconds

    monkeypatch.setattr(
        workspace, "time", SimpleNamespace(monotonic=lambda: state.now, sleep=sleep)
    )
    return state


def test_submit_and_wait_for_live(
    submitted: Mock, clock: SimpleNamespace, respx_mock: respx.MockRouter
) -> None:
    deployment = respx_mock.get(f"{HOST}/v1/deployments/7").mock(
        side_effect=[
            httpx.Response(
                200, json={"deployment": {"id": 7, "status": "creating", "live": True}}
            ),
            httpx.Response(
                200,
                json={"deployment": {"id": "7", "status": "data_ready", "live": False}},
            ),
            httpx.Response(
                200,
                json={"deployment": {"id": 7, "status": "data_ready", "live": True}},
            ),
        ]
    )
    previous = respx_mock.get(f"{HOST}/v1/deployments").respond(
        200, json={"deployments": [{"id": 7}]}
    )
    workspace.deploy_schema(HOST, TOKEN)
    submitted.assert_called_once_with(
        [
            "tb",
            "--cloud",
            "--host",
            HOST,
            "--token",
            TOKEN,
            "--output",
            "json",
            "deploy",
            "--no-wait",
            "--auto",
        ],
        capture_output=True,
        text=True,
        cwd=workspace.TINYBIRD_DIR,
        check=False,
        timeout=300,
    )
    assert deployment.call_count == 3
    assert previous.called
    assert clock.sleeps == [0.2, 0.2]
    for call in respx_mock.calls:
        assert call.request.headers["Authorization"] == f"Bearer {TOKEN}"
        assert max(call.request.extensions["timeout"].values()) <= 2


@pytest.mark.parametrize("final", [{"deployment": {"id": 3, "status": "deleted"}}, {}])
def test_waits_for_first_other_deployment(
    final: dict[str, object],
    submitted: Mock,
    clock: SimpleNamespace,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").respond(
        200, json={"deployment": {"id": 7, "status": "data_ready", "live": True}}
    )
    respx_mock.get(f"{HOST}/v1/deployments").respond(
        200, json={"deployments": [{"id": 7}, {"id": 3}, {"id": 1}]}
    )
    old = respx_mock.get(f"{HOST}/v1/deployments/3").mock(
        side_effect=[
            httpx.Response(200, json={"deployment": {"id": 3, "status": "deleting"}}),
            httpx.Response(200, json=final),
        ]
    )
    workspace.deploy_schema(HOST, TOKEN)
    assert old.call_count == 2
    assert clock.sleeps == [0.2]
    submitted.assert_called_once()


def test_failed_old_deletion_warns_and_continues(
    submitted: Mock, respx_mock: respx.MockRouter, caplog: pytest.LogCaptureFixture
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").respond(
        200, json={"deployment": {"id": 7, "status": "data_ready", "live": True}}
    )
    respx_mock.get(f"{HOST}/v1/deployments").respond(
        200, json={"deployments": [{"id": 2}]}
    )
    respx_mock.get(f"{HOST}/v1/deployments/2").respond(
        200, json={"deployment": {"id": 2, "status": "failed", "errors": [TOKEN]}}
    )
    workspace.deploy_schema(HOST, TOKEN)
    assert "old deployment failed to be removed" in caplog.text
    assert TOKEN not in caplog.text


@pytest.mark.parametrize("status", ["failed", "deleting", "deleted", "error"])
def test_failed_new_deployment_never_resubmits(
    status: str,
    submitted: Mock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").respond(
        200, json={"deployment": {"id": 7, "status": status, "live": True}}
    )
    with pytest.raises(RuntimeError, match="failed before becoming live"):
        workspace.deploy_schema(HOST, TOKEN)
    submitted.assert_called_once()


def test_never_live_times_out_without_resubmitting(
    submitted: Mock,
    clock: SimpleNamespace,
    respx_mock: respx.MockRouter,
) -> None:
    deployment = respx_mock.get(f"{HOST}/v1/deployments/7").respond(
        200, json={"deployment": {"id": 7, "status": "data_ready", "live": False}}
    )
    with pytest.raises(RuntimeError, match="Timed out"):
        workspace.deploy_schema(HOST, TOKEN)
    assert clock.now == pytest.approx(300)
    assert 1499 <= deployment.call_count <= 1501
    submitted.assert_called_once()


@pytest.mark.parametrize(
    "payload",
    [None, [], {}, {"id": None}, {"id": True}, {"id": ""}, {"id": "../other"}],
)
def test_malformed_submitted_id_fails_without_http(
    payload: object,
    submitted: Mock,
    respx_mock: respx.MockRouter,
) -> None:
    submitted.return_value.stdout = json.dumps(payload)
    with pytest.raises(RuntimeError):
        workspace.deploy_schema(HOST, TOKEN)
    assert not respx_mock.calls
    submitted.assert_called_once()


@pytest.mark.parametrize(
    "payload",
    [
        {"deployment": {"id": 8, "status": "data_ready", "live": True}},
        {"deployment": None},
        {"deployment": {"id": 7, "status": None}},
        {"error": "bad"},
        {
            "deployment": {
                "id": 7,
                "status": "data_ready",
                "live": True,
                "errors": ["bad"],
            }
        },
    ],
)
def test_invalid_readiness_response_fails(
    payload: object,
    submitted: Mock,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").respond(200, json=payload)
    with pytest.raises(RuntimeError):
        workspace.deploy_schema(HOST, TOKEN)
    submitted.assert_called_once()


def test_transient_http_failure_retries_same_id(
    submitted: Mock,
    clock: SimpleNamespace,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").mock(
        side_effect=[
            httpx.ConnectError("temporary"),
            httpx.Response(503),
            httpx.Response(
                200,
                json={"deployment": {"id": 7, "status": "data_ready", "live": True}},
            ),
        ]
    )
    respx_mock.get(f"{HOST}/v1/deployments").respond(200, json={"deployments": []})
    workspace.deploy_schema(HOST, TOKEN)
    assert clock.sleeps == [0.2, 0.2]
    submitted.assert_called_once()


@pytest.mark.parametrize("failure", [401, 403])
def test_authentication_failure_does_not_retry(
    failure: int,
    submitted: Mock,
    respx_mock: respx.MockRouter,
) -> None:
    request = respx_mock.get(f"{HOST}/v1/deployments/7").respond(failure)
    with pytest.raises(RuntimeError, match=f"HTTP {failure}"):
        workspace.deploy_schema(HOST, TOKEN)
    assert request.call_count == 1


def test_submission_failure_never_exposes_command_or_output(
    submitted: Mock,
    respx_mock: respx.MockRouter,
) -> None:
    submitted.return_value = subprocess.CompletedProcess([TOKEN], 1, TOKEN, TOKEN)
    with pytest.raises(RuntimeError) as error:
        workspace.deploy_schema(HOST, TOKEN)
    assert TOKEN not in str(error.value)
    assert not respx_mock.calls
    submitted.assert_called_once()


def test_deletion_shares_post_submit_deadline(
    submitted: Mock,
    clock: SimpleNamespace,
    respx_mock: respx.MockRouter,
) -> None:
    def became_live(request: httpx.Request) -> httpx.Response:
        clock.now = 299.9
        return httpx.Response(
            200, json={"deployment": {"id": 7, "status": "data_ready", "live": True}}
        )

    respx_mock.get(f"{HOST}/v1/deployments/7").mock(side_effect=became_live)
    respx_mock.get(f"{HOST}/v1/deployments").respond(
        200, json={"deployments": [{"id": 3}]}
    )
    old = respx_mock.get(f"{HOST}/v1/deployments/3").respond(
        200, json={"deployment": {"id": 3, "status": "deleting"}}
    )
    with pytest.raises(RuntimeError, match="Timed out"):
        workspace.deploy_schema(HOST, TOKEN)
    assert old.call_count == 1
    assert clock.now == pytest.approx(300)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="not json"),
        httpx.Response(200, json={"deployments": None}),
        httpx.Response(500),
    ],
)
def test_old_deployment_lookup_cannot_silently_succeed(
    response: httpx.Response,
    submitted: Mock,
    clock: SimpleNamespace,
    respx_mock: respx.MockRouter,
) -> None:
    respx_mock.get(f"{HOST}/v1/deployments/7").respond(
        200, json={"deployment": {"id": 7, "status": "data_ready", "live": True}}
    )
    respx_mock.get(f"{HOST}/v1/deployments").mock(return_value=response)
    with pytest.raises(RuntimeError):
        workspace.deploy_schema(HOST, TOKEN)
    submitted.assert_called_once()

import httpx
import pytest

from polar.outpost.vercel import is_vercel_affinity_warmup, warm_next_vercel_instance

URL = "https://app.test/api/meter"
PINNED = {
    "x-vercel-affinity-id": "shard-7-3",
    "x-vercel-trusted-oidc-idp-token": "oidc",
    "Authorization": "Basic merchant",
    "Content-Length": "42",
}


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({"x-polar-affinity-warmup": "1"}, True),
        ({"X-Polar-Affinity-Warmup": "1"}, True),
        ({"x-polar-affinity-warmup": "0"}, False),
        ({"authorization": "Bearer token"}, False),
    ],
)
def test_is_vercel_affinity_warmup(headers: dict[str, str], expected: bool) -> None:
    assert is_vercel_affinity_warmup(headers) is expected


@pytest.mark.anyio
async def test_warms_the_next_instance_once_from_the_instance_that_holds_the_shard() -> (
    None
):
    sent: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(204)

    async with httpx.AsyncClient(transport=httpx.MockTransport(answer)) as client:
        headers = {**PINNED, "x-polar-affinity-next": "shard-7-4"}
        for _ in range(2):
            await warm_next_vercel_instance(URL, headers, client=client)
        await warm_next_vercel_instance(URL, PINNED, client=client)
    assert len(sent) == 1
    warmup = sent[0]
    assert str(warmup.url) == URL
    assert warmup.headers["x-vercel-affinity-id"] == "shard-7-4"
    assert warmup.headers["x-vercel-trusted-oidc-idp-token"] == "oidc"
    assert warmup.headers["authorization"] == "Basic merchant"
    assert "x-polar-affinity-next" not in warmup.headers
    assert is_vercel_affinity_warmup(dict(warmup.headers))


@pytest.mark.anyio
@pytest.mark.parametrize("failure", ["offline", "503"])
async def test_warms_again_when_a_warm_up_fails_and_never_warms_its_own_instance(
    failure: str,
) -> None:
    attempts: list[httpx.Request] = []

    def answer(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        if len(attempts) > 1:
            return httpx.Response(204)
        if failure == "offline":
            raise httpx.ConnectError("offline")
        return httpx.Response(503)

    async with httpx.AsyncClient(transport=httpx.MockTransport(answer)) as client:
        headers = {**PINNED, "x-polar-affinity-next": f"shard-8-{failure}"}
        for _ in range(2):
            await warm_next_vercel_instance(URL, headers, client=client)
        own = {**PINNED, "x-polar-affinity-next": "shard-7-3"}
        await warm_next_vercel_instance(URL, own, client=client)
    assert len(attempts) == 2

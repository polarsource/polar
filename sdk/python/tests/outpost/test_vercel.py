import pytest

from polar.outpost.vercel import is_vercel_affinity_warmup


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

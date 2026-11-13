"""Regenerate client_ip_cases.json using the Python API's proxy middleware.

cd server && PYTHONPATH=. uv run python ../events/tests/fixtures/generate_client_ip_cases.py
"""

import asyncio
import json
from pathlib import Path

from starlette.requests import Request
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from polar.kit.http import get_ip_address


async def main() -> None:
    cases = []
    for trusted in (
        "127.0.0.1",
        "10.0.0.0/8, 172.64.0.0/13",
        "*",
        "::1, 2001:db8::/32",
    ):
        for peer in ("10.0.0.9", "198.51.100.4", "::1", None):
            for forwarded in (
                [],
                [""],
                ["6.6.6.6, 203.0.113.7, 172.70.1.1, 10.0.0.2"],
                ["6.6.6.6", "203.0.113.7, 172.70.1.1"],
                ["203.0.113.7", ""],
                [", 10.0.0.2"],
                ["203.0.113.7, , 10.0.0.2"],
                ["10.0.0.2, 10.0.0.3"],
                ["203.0.113.7:4711"],
                ["203.0.113.7:-1"],
                ["203.0.113.7:9999999999999999999999999"],
                ["203.0.113.7:4_711"],
                ["[2001:db8::1]:4711, [::1]"],
                ["203.0.113.7:invalid"],
                ["[::1"],
                ["[::1]invalid"],
                ["[::1]:invalid"],
            ):
                for true_client in (
                    (None, "198.51.100.1", "", " ") if not forwarded else (None,)
                ):
                    headers = [
                        (b"x-forwarded-for", value.encode()) for value in forwarded
                    ]
                    if true_client is not None:
                        headers.append((b"true-client-ip", true_client.encode()))
                    scope = {
                        "type": "http",
                        "headers": headers,
                        "client": (peer, 1234) if peer else None,
                    }
                    result = None

                    async def app(scope, receive, send):
                        nonlocal result
                        result = get_ip_address(Request(scope))

                    await ProxyHeadersMiddleware(app, trusted)(scope, None, None)
                    cases.append(
                        {
                            "trusted": trusted,
                            "peer": peer,
                            "forwarded": forwarded,
                            "true_client": true_client,
                            "expected": result,
                        }
                    )
    Path(__file__).with_name("client_ip_cases.json").write_text(
        "[\n" + ",\n".join(json.dumps(case) for case in cases) + "\n]\n"
    )


asyncio.run(main())

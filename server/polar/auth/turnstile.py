import httpx

from polar.config import settings
from polar.exceptions import NotPermitted

turnstile_client = httpx.AsyncClient(
    base_url="https://challenges.cloudflare.com/turnstile/v0"
)


async def verify_turnstile(token: str, remote_ip: str | None) -> None:
    try:
        response = await turnstile_client.post(
            "/siteverify",
            data={
                "secret": settings.TURNSTILE_SECRET,
                "response": token,
                "remoteip": remote_ip or "",
            },
        )
        result = response.json()
    except httpx.HTTPError as e:
        raise NotPermitted("Turnstile verification failed") from e

    if not isinstance(result, dict) or result.get("success") is not True:
        raise NotPermitted("Turnstile verification failed")

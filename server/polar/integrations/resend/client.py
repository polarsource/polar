from typing import Any
from urllib.parse import quote

import httpx

from polar.config import settings


class ResendClient:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=settings.RESEND_API_BASE_URL,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        )

    async def get_contact(self, id_or_email: str) -> dict[str, Any] | None:
        response = await self.client.get(f"/contacts/{quote(id_or_email, safe='')}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    async def create_contact(
        self, email: str, *, unsubscribed: bool = False
    ) -> dict[str, Any]:
        response = await self.client.post(
            "/contacts", json={"email": email, "unsubscribed": unsubscribed}
        )
        response.raise_for_status()
        return response.json()

    async def add_contact_to_segment(self, contact_id: str, segment_id: str) -> None:
        response = await self.client.post(
            f"/contacts/{contact_id}/segments/{segment_id}"
        )
        response.raise_for_status()

    async def update_contact(self, contact_id: str, *, unsubscribed: bool) -> None:
        response = await self.client.patch(
            f"/contacts/{contact_id}", json={"unsubscribed": unsubscribed}
        )
        response.raise_for_status()

    async def delete_contact(self, contact_id: str) -> None:
        response = await self.client.delete(f"/contacts/{contact_id}")
        if response.status_code != 404:
            response.raise_for_status()


client = ResendClient()

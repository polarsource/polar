from typing import Any

import httpx
import structlog

log = structlog.get_logger()

BASE_URL = "https://slack.com/api"


class SlackClient:
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(base_url=BASE_URL)

    async def oauth_v2_access(
        self,
        *,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
    ) -> dict[str, Any]:
        response = await self.client.post(
            "/oauth.v2.access",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        return response.json()

    async def conversations_create(
        self,
        *,
        bot_token: str,
        name: str,
        is_private: bool,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.create",
            bot_token=bot_token,
            json={"name": name, "is_private": is_private},
        )

    async def conversations_list(
        self,
        *,
        bot_token: str,
        cursor: str | None = None,
        limit: int = 200,
        types: list[str] | None = None,
        exclude_archived: bool = True,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "exclude_archived": str(exclude_archived).lower(),
            "limit": limit,
        }
        if cursor:
            params["cursor"] = cursor
        if types:
            params["types"] = ",".join(types)
        response = await self.client.get(
            "/conversations.list",
            params=params,
            headers={"Authorization": f"Bearer {bot_token}"},
        )
        response.raise_for_status()
        return response.json()

    async def conversations_join(
        self,
        *,
        bot_token: str,
        channel: str,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.join",
            bot_token=bot_token,
            json={"channel": channel},
        )

    async def conversations_invite_shared(
        self,
        *,
        bot_token: str,
        channel: str,
        email: str,
        external_limited: bool = True,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.inviteShared",
            bot_token=bot_token,
            json={
                "channel": channel,
                "emails": [email],
                "external_limited": external_limited,
            },
        )

    async def conversations_invite(
        self,
        *,
        bot_token: str,
        channel: str,
        users: list[str],
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.invite",
            bot_token=bot_token,
            json={"channel": channel, "users": ",".join(users)},
        )

    async def users_list(
        self,
        *,
        bot_token: str,
        cursor: str | None = None,
        limit: int = 200,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        response = await self.client.get(
            "/users.list",
            params=params,
            headers={"Authorization": f"Bearer {bot_token}"},
        )
        response.raise_for_status()
        return response.json()

    async def conversations_archive(
        self,
        *,
        bot_token: str,
        channel: str,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.archive",
            bot_token=bot_token,
            json={"channel": channel},
        )

    async def conversations_unarchive(
        self,
        *,
        bot_token: str,
        channel: str,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/conversations.unarchive",
            bot_token=bot_token,
            json={"channel": channel},
        )

    async def chat_post_message(
        self,
        *,
        bot_token: str,
        channel: str,
        text: str,
    ) -> dict[str, Any]:
        return await self._post_authed(
            "/chat.postMessage",
            bot_token=bot_token,
            json={"channel": channel, "text": text},
        )

    async def _post_authed(
        self,
        path: str,
        *,
        bot_token: str,
        json: dict[str, Any],
    ) -> dict[str, Any]:
        response = await self.client.post(
            path,
            json=json,
            headers={
                "Authorization": f"Bearer {bot_token}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
        response.raise_for_status()
        return response.json()

    async def aclose(self) -> None:
        await self.client.aclose()

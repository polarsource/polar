from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase

from .oauth2 import Oauth2Async, Oauth2Sync


class ClientsSync(SyncServiceBase):
    oauth2: Oauth2Sync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.oauth2 = Oauth2Sync.from_service(self)


class ClientsAsync(AsyncServiceBase):
    oauth2: Oauth2Async

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.oauth2 = Oauth2Async.from_service(self)

from collections.abc import Callable, Coroutine
from typing import Any, Generic, TypeVar

T = TypeVar("T")
HookFunc = Callable[[T], Coroutine[Any, Any, Any]]


class Hook(Generic[T]):
    hooks: list[HookFunc[T]]

    def __init__(self) -> None:
        self.hooks = []

    def add(self, fun: HookFunc[T]) -> None:
        if fun in self.hooks:
            raise Exception(f"fun is already registered! fun={fun} hooks={self.hooks}")

        self.hooks.append(fun)

    async def call(self, payload: T) -> None:
        for fn in self.hooks:
            await fn(payload)

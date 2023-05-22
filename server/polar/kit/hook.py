from typing import Any, Callable, Coroutine, Generic, TypeVar

T = TypeVar("T")
HookFunc = Callable[[T], Coroutine[Any, Any, Any]]


class Hook(Generic[T]):
    hooks: list[HookFunc] = []

    def add(self, fun: HookFunc):
        self.hooks.append(fun)

    async def call(self, payload: T):
        for fn in self.hooks:
            await fn(payload)

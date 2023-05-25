from typing import Any, Callable, Coroutine, Generic, TypeVar

T = TypeVar("T")
HookFunc = Callable[[T], Coroutine[Any, Any, Any]]


class Hook(Generic[T]):
    hooks: list[HookFunc]

    def __init__(self):
        self.hooks = []

    def add(self, fun: HookFunc):
        if fun in self.hooks:
            raise Exception(f"fun is already registered! fun={fun} hooks={self.hooks}")

        self.hooks.append(fun)

    async def call(self, payload: T):
        for fn in self.hooks:
            await fn(payload)

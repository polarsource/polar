from typing import Callable, Generic, TypeVar

T = TypeVar("T")
HookFunc = Callable[[T], None]


class Hook(Generic[T]):
    hooks: list[HookFunc] = []

    def reg(self, fun: HookFunc):
        self.hooks.append(fun)

    def call(self, payload: T):
        for fn in self.hooks:
            fn(payload)

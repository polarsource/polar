import os
from typing import Callable, Tuple

import structlog
from jinja2 import BaseLoader, Environment, TemplateNotFound

log = structlog.get_logger()


class PolarLoader(BaseLoader):
    def __init__(self, path: str) -> None:
        self.path = path

    def get_source(
        self, environment: "Environment", template: str
    ) -> Tuple[str, str | None, Callable[[], bool] | None]:
        path = os.path.join(self.path, template)
        if not os.path.exists(path):
            raise TemplateNotFound(template)

        mtime = os.path.getmtime(path)
        with open(path) as f:
            source = f.read()

        return source, path, lambda: mtime == os.path.getmtime(path)


polar_package_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
env = Environment(
    loader=PolarLoader(polar_package_root),
)


def render(filename: str, **kwargs: str) -> str:
    return env.get_template(filename).render(**kwargs)


__all__ = [
    "render",
]

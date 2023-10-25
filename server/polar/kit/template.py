from collections.abc import Callable
from pathlib import Path

import structlog
from jinja2 import BaseLoader, Environment, TemplateNotFound

log = structlog.get_logger()


class PolarLoader(BaseLoader):
    def __init__(self, path: Path) -> None:
        self.path = path

    def get_source(
        self, environment: "Environment", template: str
    ) -> tuple[str, str | None, Callable[[], bool] | None]:
        path = Path(self.path, template)
        if not path.exists():
            raise TemplateNotFound(template)

        mtime = path.stat().st_mtime
        with open(path) as f:
            source = f.read()

        return source, str(path), lambda: mtime == Path(path).stat().st_mtime


polar_package_root = Path(__file__).parent.absolute()
env = Environment(
    loader=PolarLoader(polar_package_root),
)


def path(__from_file__: str, relative_filename: str) -> Path:
    from_dir = Path(__from_file__).parent.absolute()
    base = str(from_dir).replace(str(polar_package_root), "")
    return Path(polar_package_root, base, relative_filename)


def render(filename: Path | str, **kwargs: str) -> str:
    return env.get_template(str(filename)).render(**kwargs)


__all__ = [
    "path",
    "render",
]

from textual.app import ComposeResult
from textual.widgets import Header, Static

from polar.config import Environment, settings


class PolarHeader(Header):
    DEFAULT_CSS = """
    PolarHeader.production {
        background: $warning;
        color: auto;
        text-style: bold;
    }

    Static {
        dock: right;
        width: auto;
        padding: 0 1;
        content-align: center middle;
    }
    """

    def __init__(
        self,
        environment: Environment = settings.ENV,
        *,
        name: str | None = None,
        id: str | None = None,
        classes: str | None = None,
    ):
        self.environment = environment
        self.production = environment == Environment.production
        if self.production:
            classes = f"{classes} production" if classes else "production"
        super().__init__(False, name=name, id=id, classes=classes)

    def compose(self) -> ComposeResult:
        yield from super().compose()
        yield Static(self.environment.value.upper())


__all__ = ["PolarHeader"]

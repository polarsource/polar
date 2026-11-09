import dataclasses
import typing

from polar.{{ latest }}.inputs import ConfigSettings
from polar.{{ latest }}.literals import PresentmentCurrency, TaxBehaviorOption


@dataclasses.dataclass(frozen=True, kw_only=True)
class PaymentSettings:
    """Payment defaults: the presentment currency every active product must price in,
    and the tax behavior prices use unless they set their own."""

    currency: PresentmentCurrency | None = None
    tax: TaxBehaviorOption | None = None


GROUPS: dict[str, type] = {"payments": PaymentSettings}


class SettingsSet:
    """Organization settings the config manages, one attribute per group:

        class Settings(SettingsSet):
            payments = PaymentSettings(currency="usd")

    Groups left out stay untouched.
    """

    _groups: typing.ClassVar[dict[str, typing.Any]] = {}

    def __init_subclass__(cls) -> None:
        super().__init_subclass__()
        groups: dict[str, typing.Any] = {}
        for name, value in vars(cls).items():
            if name.startswith("_") or isinstance(
                value, type | classmethod | staticmethod | property
            ):
                continue
            expected = GROUPS.get(name)
            if expected is None:
                raise TypeError(
                    f"{cls.__name__}.{name} is not a settings group; "
                    f"expected one of {', '.join(GROUPS)}."
                )
            if not isinstance(value, expected):
                raise TypeError(
                    f"{cls.__name__}.{name} must be a {expected.__name__}, got {type(value).__name__}."
                )
            groups[name] = value
        cls._groups = groups

    @classmethod
    def groups(cls) -> dict[str, typing.Any]:
        return dict(cls._groups)


def settings_config(settings: type[SettingsSet]) -> ConfigSettings:
    config = {
        name: {
            key: value
            for key, value in dataclasses.asdict(group).items()
            if value is not None
        }
        for name, group in settings.groups().items()
    }
    return typing.cast(ConfigSettings, config)

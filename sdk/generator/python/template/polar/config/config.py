import collections.abc
import json
import typing

from polar.config.benefits import BenefitSet, Credits, benefit_config
from polar.config.definitions import Definition
from polar.config.meters import MeterSet, meter_config
from polar.config.prices import Metered
from polar.config.products import ProductSet, product_config
from polar.config.settings import PaymentSettings, SettingsSet, settings_config
from polar.config.webhooks import WebhookSet, webhook_config
from polar.{{ latest }}.inputs import Config as ConfigDict

Kind: typing.TypeAlias = typing.Literal["meter", "benefit", "product"]


class Config:
    """The billing config `polar config plan` and `polar config apply` read.

    Pass your `MeterSet`, `BenefitSet`, `ProductSet`, `WebhookSet` and `SettingsSet`
    classes; it checks the references between them and compiles to the JSON the API accepts.
    """

    def __init__(
        self,
        *,
        meters: type[MeterSet] | None = None,
        benefits: type[BenefitSet] | None = None,
        products: type[ProductSet] | None = None,
        webhooks: type[WebhookSet] | None = None,
        settings: type[SettingsSet] | None = None,
    ) -> None:
        self.data = _compile(meters, benefits, products, webhooks, settings)

    def to_dict(self) -> ConfigDict:
        return self.data

    def to_json(self) -> str:
        return json.dumps(self.data, indent=2) + "\n"


def _compile(
    meters: type[MeterSet] | None,
    benefits: type[BenefitSet] | None,
    products: type[ProductSet] | None,
    webhooks: type[WebhookSet] | None,
    settings: type[SettingsSet] | None,
) -> ConfigDict:
    meter_definitions = meters.definitions() if meters else []
    for definition in meter_definitions:
        _check_name("meter", definition.id, definition.name, 3, None)
    known_meters = {definition.id: definition for definition in meter_definitions}
    config: dict[str, typing.Any] = {
        "meters": [meter_config(d) for d in meter_definitions]
    }
    if settings is not None:
        config["settings"] = settings_config(settings)
    known_benefits: dict[str, Definition] = {}
    if benefits is not None:
        for benefit in benefits.definitions():
            _check_name("benefit", benefit.id, benefit.name, 3, 42)
            if isinstance(benefit, Credits):
                _check_references(
                    f'Benefit "{benefit.id}"',
                    "meter",
                    [benefit.meter],
                    known_meters,
                    benefit,
                )
            known_benefits[benefit.id] = benefit
        config["benefits"] = [benefit_config(b) for b in benefits.definitions()]
    if products is not None:
        payments: PaymentSettings | None = (
            settings.groups().get("payments") if settings is not None else None
        )
        default_currency = payments.currency if payments is not None else None
        for product in products.definitions():
            _check_name("product", product.id, product.name, 3, 64)
            owner = f'Product "{product.id}"'
            priced = [
                price.meter for price in product.prices if isinstance(price, Metered)
            ]
            _check_references(owner, "meter", priced, known_meters, product)
            _check_references(owner, "benefit", product.grants, known_benefits, product)
        config["products"] = [
            product_config(p, default_currency) for p in products.definitions()
        ]
    if webhooks is not None:
        config["webhooks"] = [webhook_config(w) for w in webhooks.definitions()]
    return typing.cast(ConfigDict, config)


def _check_name(
    kind: Kind, external_id: str, name: str | None, minimum: int, maximum: int | None
) -> None:
    fits = minimum <= len(external_id) and (
        maximum is None or len(external_id) <= maximum
    )
    if name is not None or fits:
        return
    span = (
        f"shorter than {minimum}"
        if maximum is None
        else f"not between {minimum} and {maximum}"
    )
    raise ValueError(
        f'Provide a name for {kind} "{external_id}" because its attribute name is {span} characters.'
    )


def _check_references(
    owner: str,
    kind: Kind,
    references: collections.abc.Iterable[Definition],
    known: collections.abc.Mapping[str, Definition],
    by: Definition,
) -> None:
    for reference in references:
        declared = known.get(reference.id)
        if declared is None or declared is not reference:
            raise ValueError(
                f"{owner} references {kind} {reference.describe()}, which is not in the "
                f"{kind}s passed to Config()."
            )
        if reference.deprecated and not by.deprecated:
            raise ValueError(
                f'{owner} uses {kind} "{reference.id}", which is deprecated. '
                f"Undeprecate the {kind} or create a new one."
            )

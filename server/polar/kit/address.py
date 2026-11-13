from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Any, NotRequired, Self, TypedDict, cast

import pycountry
from pydantic import BaseModel, BeforeValidator, Field, model_validator
from pydantic.json_schema import WithJsonSchema
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import EmptyStrToNone


def upper_if_str(value: Any) -> Any:
    if isinstance(value, str):
        return value.upper()
    return value


class CountryData:
    alpha_2: str


_ALL_COUNTRIES: set[str] = {
    cast(CountryData, country).alpha_2 for country in pycountry.countries
}
_SUPPORTED_COUNTRIES: set[str] = _ALL_COUNTRIES - {
    # US Trade Embargos
    "CU",
    "IR",
    "KP",
    "SY",
    "RU",
}
ALL_COUNTRIES = sorted(_ALL_COUNTRIES)
SUPPORTED_COUNTRIES = sorted(_SUPPORTED_COUNTRIES)

if TYPE_CHECKING:

    class CountryAlpha2(StrEnum):
        pass

    class CountryAlpha2Input(StrEnum):
        pass
else:
    CountryAlpha2 = Annotated[
        StrEnum("CountryAlpha2", [(country, country) for country in ALL_COUNTRIES]),
        WithJsonSchema(
            {
                "type": "string",
                "title": "CountryAlpha2",
                "enum": ALL_COUNTRIES,
                "x-speakeasy-enums": ALL_COUNTRIES,
            }
        ),
    ]
    CountryAlpha2Input = Annotated[
        StrEnum(
            "CountryAlpha2Input",
            [(country, country) for country in SUPPORTED_COUNTRIES],
        ),
        WithJsonSchema(
            {
                "type": "string",
                "title": "CountryAlpha2Input",
                "enum": SUPPORTED_COUNTRIES,
                "x-speakeasy-enums": SUPPORTED_COUNTRIES,
            }
        ),
    ]


class USState(StrEnum):
    US_AL = "US-AL"
    US_AK = "US-AK"
    US_AZ = "US-AZ"
    US_AR = "US-AR"
    US_CA = "US-CA"
    US_CO = "US-CO"
    US_CT = "US-CT"
    US_DE = "US-DE"
    US_FL = "US-FL"
    US_GA = "US-GA"
    US_HI = "US-HI"
    US_ID = "US-ID"
    US_IL = "US-IL"
    US_IN = "US-IN"
    US_IA = "US-IA"
    US_KS = "US-KS"
    US_KY = "US-KY"
    US_LA = "US-LA"
    US_ME = "US-ME"
    US_MD = "US-MD"
    US_MA = "US-MA"
    US_MI = "US-MI"
    US_MN = "US-MN"
    US_MS = "US-MS"
    US_MO = "US-MO"
    US_MT = "US-MT"
    US_NE = "US-NE"
    US_NV = "US-NV"
    US_NH = "US-NH"
    US_NJ = "US-NJ"
    US_NM = "US-NM"
    US_NY = "US-NY"
    US_NC = "US-NC"
    US_ND = "US-ND"
    US_OH = "US-OH"
    US_OK = "US-OK"
    US_OR = "US-OR"
    US_PA = "US-PA"
    US_RI = "US-RI"
    US_SC = "US-SC"
    US_SD = "US-SD"
    US_TN = "US-TN"
    US_TX = "US-TX"
    US_UT = "US-UT"
    US_VT = "US-VT"
    US_VA = "US-VA"
    US_WA = "US-WA"
    US_WV = "US-WV"
    US_WI = "US-WI"
    US_WY = "US-WY"
    US_DC = "US-DC"


class CASubdivision(StrEnum):
    CA_AB = "CA-AB"
    CA_BC = "CA-BC"
    CA_MB = "CA-MB"
    CA_NB = "CA-NB"
    CA_NL = "CA-NL"
    CA_NS = "CA-NS"
    CA_NT = "CA-NT"
    CA_NU = "CA-NU"
    CA_ON = "CA-ON"
    CA_PE = "CA-PE"
    CA_QC = "CA-QC"
    CA_SK = "CA-SK"
    CA_YT = "CA-YT"


class BRState(StrEnum):
    BR_AC = "BR-AC"
    BR_AL = "BR-AL"
    BR_AM = "BR-AM"
    BR_AP = "BR-AP"
    BR_BA = "BR-BA"
    BR_CE = "BR-CE"
    BR_DF = "BR-DF"
    BR_ES = "BR-ES"
    BR_GO = "BR-GO"
    BR_MA = "BR-MA"
    BR_MG = "BR-MG"
    BR_MS = "BR-MS"
    BR_MT = "BR-MT"
    BR_PA = "BR-PA"
    BR_PB = "BR-PB"
    BR_PE = "BR-PE"
    BR_PI = "BR-PI"
    BR_PR = "BR-PR"
    BR_RJ = "BR-RJ"
    BR_RN = "BR-RN"
    BR_RO = "BR-RO"
    BR_RR = "BR-RR"
    BR_RS = "BR-RS"
    BR_SC = "BR-SC"
    BR_SE = "BR-SE"
    BR_SP = "BR-SP"
    BR_TO = "BR-TO"


SUBDIVISIONS: dict[str, type[StrEnum]] = {
    "US": USState,
    "CA": CASubdivision,
    "BR": BRState,
}

STATE_REQUIRED_COUNTRIES: frozenset[str] = frozenset({"US", "CA", "BR"})
POSTAL_CODE_REQUIRED_COUNTRIES: frozenset[str] = frozenset({"US", "ES", "PT"})
CITY_REQUIRED_COUNTRIES: frozenset[str] = frozenset({"BR"})


class AddressDict(TypedDict):
    line1: NotRequired[str]
    line2: NotRequired[str]
    postal_code: NotRequired[str]
    city: NotRequired[str]
    state: NotRequired[str]
    country: str


class Address(BaseModel):
    line1: EmptyStrToNone | None = None
    line2: EmptyStrToNone | None = None
    postal_code: EmptyStrToNone | None = None
    city: EmptyStrToNone | None = None
    state: EmptyStrToNone | None = None
    country: CountryAlpha2 = Field(examples=["US", "SE", "FR"])

    @model_validator(mode="after")
    def validate_state(self) -> Self:
        if self.state is None:
            return self

        subdivisions = SUBDIVISIONS.get(self.country)
        if subdivisions is None:
            return self

        state = self.state
        if not state.startswith(f"{self.country}-"):
            state = f"{self.country}-{state}"

        if state in subdivisions:
            self.state = state
        # Stored addresses may predate validation for the other countries
        elif self.country == "US":
            raise ValueError("Invalid US state")
        elif self.country == "CA":
            raise ValueError("Invalid CA subdivision")

        return self

    def to_dict(self) -> AddressDict:
        return cast(AddressDict, self.model_dump(exclude_none=True))

    def get_unprefixed_state(self) -> str | None:
        if self.state is None:
            return None
        if self.country in SUBDIVISIONS:
            return self.state.removeprefix(f"{self.country}-")
        return self.state

    def has_state(self) -> bool:
        return self.state is not None

    def has_address(self) -> bool:
        return (
            self.line1 is not None
            or self.line2 is not None
            or self.city is not None
            or self.postal_code is not None
        )

    def to_text(self) -> str:
        lines = []
        if self.line1:
            lines.append(self.line1)
        if self.line2:
            lines.append(self.line2)

        city_line = ""
        if self.city:
            city_line += self.city
        if self.state:
            state = pycountry.subdivisions.get(code=self.state)
            if state is not None:
                city_line += f", {cast(Any, state.name)}"
            else:
                city_line += f", {self.get_unprefixed_state()}"
        if self.postal_code:
            city_line += f" {self.postal_code}"
        if city_line:
            lines.append(city_line)

        if self.country:
            country = pycountry.countries.get(alpha_2=self.country)
            if country is not None:
                lines.append(country.name)
            else:
                lines.append(self.country)

        return "\n".join(lines)


class AddressInput(Address):
    country: Annotated[CountryAlpha2Input, BeforeValidator(upper_if_str)] = Field(  # type: ignore
        examples=["US", "SE", "FR"]
    )

    @model_validator(mode="after")
    def validate_subdivision(self) -> Self:
        subdivisions = SUBDIVISIONS.get(self.country)
        if (
            self.state is not None
            and subdivisions is not None
            and self.state not in subdivisions
        ):
            raise ValueError(f"Invalid {self.country} state")
        return self


class AddressType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, Address):
            return value.model_dump(exclude_none=True)
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return Address.model_validate(value)
        return value

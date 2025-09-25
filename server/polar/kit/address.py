from enum import StrEnum
from typing import TYPE_CHECKING, Annotated, Any, NotRequired, Self, TypedDict, cast

import pycountry
from pydantic import BaseModel, BeforeValidator, Field, model_validator
from pydantic.json_schema import WithJsonSchema
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import EmptyStrToNone


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


class CAProvince(StrEnum):
    CA_AB = "CA-AB"
    CA_BC = "CA-BC"
    CA_MB = "CA-MB"
    CA_NB = "CA-NB"
    CA_NL = "CA-NL"
    CA_NS = "CA-NS"
    CA_ON = "CA-ON"
    CA_PE = "CA-PE"
    CA_QC = "CA-QC"
    CA_SK = "CA-SK"


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

        # Normalize US and CA state with a prefix
        if self.country in {"US", "CA"}:
            if not self.state.startswith(f"{self.country}-"):
                self.state = f"{self.country}-{self.state}"

        # Validate US and CA state
        if self.country == "US" and self.state not in USState:
            raise ValueError("Invalid US state")
        if self.country == "CA" and self.state not in CAProvince:
            raise ValueError("Invalid CA province")

        return self

    def to_dict(self) -> AddressDict:
        return cast(AddressDict, self.model_dump(exclude_none=True))

    def get_unprefixed_state(self) -> str | None:
        if self.state is None:
            return None
        if self.country in {"US", "CA"}:
            return self.state.split("-")[1]
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
    country: Annotated[CountryAlpha2Input, BeforeValidator(str.upper)] = Field(  # type: ignore
        examples=["US", "SE", "FR"]
    )


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

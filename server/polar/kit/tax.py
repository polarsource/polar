import hashlib
import json
import uuid
from collections.abc import Sequence
from enum import StrEnum
from typing import Annotated, Any, Literal, LiteralString, Protocol, TypedDict

import stdnum.ca.bn
import stdnum.cl.rut
import stdnum.exceptions
import stdnum.in_.gstin
import stdnum.tr.vkn
import stdnum.vn.mst
import stripe as stripe_lib
import structlog
from pydantic import Field
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator
from stdnum import get_cc_module

from polar.config import settings
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.address import Address
from polar.logging import Logger

log: Logger = structlog.get_logger()


class TaxIDFormat(StrEnum):
    """
    List of supported tax ID formats.

    Ref: https://docs.stripe.com/billing/customer/tax-ids#supported-tax-id
    """

    ad_nrt = "ad_nrt"
    ae_trn = "ae_trn"
    ar_cuit = "ar_cuit"
    au_abn = "au_abn"
    au_arn = "au_arn"
    bg_uic = "bg_uic"
    bh_vat = "bh_vat"
    bo_tin = "bo_tin"
    br_cnpj = "br_cnpj"
    br_cpf = "br_cpf"
    ca_bn = "ca_bn"
    ca_gst_hst = "ca_gst_hst"
    ca_pst_bc = "ca_pst_bc"
    ca_pst_mb = "ca_pst_mb"
    ca_pst_sk = "ca_pst_sk"
    ca_qst = "ca_qst"
    ch_uid = "ch_uid"
    ch_vat = "ch_vat"
    cl_tin = "cl_tin"
    cn_tin = "cn_tin"
    co_nit = "co_nit"
    cr_tin = "cr_tin"
    de_stn = "de_stn"
    do_rcn = "do_rcn"
    ec_ruc = "ec_ruc"
    eg_tin = "eg_tin"
    es_cif = "es_cif"
    eu_oss_vat = "eu_oss_vat"
    eu_vat = "eu_vat"
    gb_vat = "gb_vat"
    ge_vat = "ge_vat"
    hk_br = "hk_br"
    hr_oib = "hr_oib"
    hu_tin = "hu_tin"
    id_npwp = "id_npwp"
    il_vat = "il_vat"
    in_gst = "in_gst"
    is_vat = "is_vat"
    jp_cn = "jp_cn"
    jp_rn = "jp_rn"
    jp_trn = "jp_trn"
    ke_pin = "ke_pin"
    kr_brn = "kr_brn"
    kz_bin = "kz_bin"
    li_uid = "li_uid"
    mx_rfc = "mx_rfc"
    my_frp = "my_frp"
    my_itn = "my_itn"
    my_sst = "my_sst"
    ng_tin = "ng_tin"
    no_vat = "no_vat"
    no_voec = "no_voec"
    nz_gst = "nz_gst"
    om_vat = "om_vat"
    pe_ruc = "pe_ruc"
    ph_tin = "ph_tin"
    ro_tin = "ro_tin"
    rs_pib = "rs_pib"
    ru_inn = "ru_inn"
    ru_kpp = "ru_kpp"
    sa_vat = "sa_vat"
    sg_gst = "sg_gst"
    sg_uen = "sg_uen"
    si_tin = "si_tin"
    sv_nit = "sv_nit"
    th_vat = "th_vat"
    tr_tin = "tr_tin"
    tw_vat = "tw_vat"
    ua_vat = "ua_vat"
    us_ein = "us_ein"
    uy_ruc = "uy_ruc"
    ve_rif = "ve_rif"
    vn_tin = "vn_tin"
    za_vat = "za_vat"


COUNTRY_TAX_ID_MAP: dict[str, Sequence[TaxIDFormat]] = {
    "AD": (TaxIDFormat.ad_nrt,),
    "AE": (TaxIDFormat.ae_trn,),
    "AR": (TaxIDFormat.ar_cuit,),
    "AT": (TaxIDFormat.eu_vat,),
    "AU": (TaxIDFormat.au_abn, TaxIDFormat.au_arn),
    "BE": (TaxIDFormat.eu_vat,),
    "BG": (TaxIDFormat.bg_uic, TaxIDFormat.eu_vat),
    "BH": (TaxIDFormat.bh_vat,),
    "BO": (TaxIDFormat.bo_tin,),
    "BR": (TaxIDFormat.br_cnpj, TaxIDFormat.br_cpf),
    "CA": (
        TaxIDFormat.ca_gst_hst,
        TaxIDFormat.ca_pst_bc,
        TaxIDFormat.ca_pst_mb,
        TaxIDFormat.ca_pst_sk,
        TaxIDFormat.ca_qst,
        TaxIDFormat.ca_bn,
    ),
    "CH": (TaxIDFormat.ch_uid, TaxIDFormat.ch_vat),
    "CL": (TaxIDFormat.cl_tin,),
    "CN": (TaxIDFormat.cn_tin,),
    "CO": (TaxIDFormat.co_nit,),
    "CR": (TaxIDFormat.cr_tin,),
    "CY": (TaxIDFormat.eu_vat,),
    "CZ": (TaxIDFormat.eu_vat,),
    "DE": (TaxIDFormat.de_stn, TaxIDFormat.eu_vat),
    "DK": (TaxIDFormat.eu_vat,),
    "DO": (TaxIDFormat.do_rcn,),
    "EC": (TaxIDFormat.ec_ruc,),
    "EE": (TaxIDFormat.eu_vat,),
    "EG": (TaxIDFormat.eg_tin,),
    "ES": (TaxIDFormat.es_cif, TaxIDFormat.eu_vat),
    "FI": (TaxIDFormat.eu_vat,),
    "FR": (TaxIDFormat.eu_vat,),
    "GB": (TaxIDFormat.gb_vat,),
    "GE": (TaxIDFormat.ge_vat,),
    "GR": (TaxIDFormat.eu_vat,),
    "HK": (TaxIDFormat.hk_br,),
    "HR": (TaxIDFormat.hr_oib, TaxIDFormat.eu_vat),
    "HU": (TaxIDFormat.hu_tin, TaxIDFormat.eu_vat),
    "ID": (TaxIDFormat.id_npwp,),
    "IE": (TaxIDFormat.eu_vat,),
    "IL": (TaxIDFormat.il_vat,),
    "IN": (TaxIDFormat.in_gst,),
    "IS": (TaxIDFormat.is_vat,),
    "IT": (TaxIDFormat.eu_vat,),
    "JP": (TaxIDFormat.jp_cn, TaxIDFormat.jp_rn, TaxIDFormat.jp_trn),
    "KE": (TaxIDFormat.ke_pin,),
    "KR": (TaxIDFormat.kr_brn,),
    "KZ": (TaxIDFormat.kz_bin,),
    "LI": (TaxIDFormat.li_uid,),
    "LT": (TaxIDFormat.eu_vat,),
    "LU": (TaxIDFormat.eu_vat,),
    "LV": (TaxIDFormat.eu_vat,),
    "MT": (TaxIDFormat.eu_vat,),
    "MX": (TaxIDFormat.mx_rfc,),
    "MY": (TaxIDFormat.my_frp, TaxIDFormat.my_itn, TaxIDFormat.my_sst),
    "NG": (TaxIDFormat.ng_tin,),
    "NL": (TaxIDFormat.eu_vat,),
    "NO": (TaxIDFormat.no_vat, TaxIDFormat.no_voec),
    "NZ": (TaxIDFormat.nz_gst,),
    "OM": (TaxIDFormat.om_vat,),
    "PE": (TaxIDFormat.pe_ruc,),
    "PH": (TaxIDFormat.ph_tin,),
    "PL": (TaxIDFormat.eu_vat,),
    "PT": (TaxIDFormat.eu_vat,),
    "RO": (TaxIDFormat.ro_tin, TaxIDFormat.eu_vat),
    "RS": (TaxIDFormat.rs_pib,),
    "RU": (TaxIDFormat.ru_inn, TaxIDFormat.ru_kpp),
    "SA": (TaxIDFormat.sa_vat,),
    "SE": (TaxIDFormat.eu_vat,),
    "SG": (TaxIDFormat.sg_gst, TaxIDFormat.sg_uen),
    "SI": (TaxIDFormat.si_tin, TaxIDFormat.eu_vat),
    "SK": (TaxIDFormat.eu_vat,),
    "SV": (TaxIDFormat.sv_nit,),
    "TH": (TaxIDFormat.th_vat,),
    "TR": (TaxIDFormat.tr_tin,),
    "TW": (TaxIDFormat.tw_vat,),
    "UA": (TaxIDFormat.ua_vat,),
    "US": (TaxIDFormat.us_ein,),
    "UY": (TaxIDFormat.uy_ruc,),
    "VE": (TaxIDFormat.ve_rif,),
    "VN": (TaxIDFormat.vn_tin,),
    "ZA": (TaxIDFormat.za_vat,),
}

TaxID = Annotated[
    tuple[str, TaxIDFormat],
    Field(examples=[("911144442", "us_ein"), ("FR61954506077", "eu_vat")]),
]


class TaxError(PolarError): ...


class UnsupportedTaxIDFormat(TaxError):
    def __init__(self, tax_id_type: TaxIDFormat) -> None:
        self.tax_id_type = tax_id_type
        super().__init__(f"Tax ID format {tax_id_type} is not supported.")


class InvalidTaxID(TaxError):
    def __init__(self, tax_id: str, country: str) -> None:
        self.tax_id = tax_id
        self.country = country
        super().__init__("Invalid tax ID.")


class ValidatorProtocol(Protocol):
    def validate(self, number: str, country: str) -> str: ...


class StdNumValidator(ValidatorProtocol):
    def __init__(self, tax_id_type: TaxIDFormat):
        tax_id_country, tax_id_format = tax_id_type.split("_", 1)
        module = get_cc_module(tax_id_country, tax_id_format)
        if module is None:
            raise UnsupportedTaxIDFormat(tax_id_type)
        self.module = module

    def validate(self, number: str, country: str) -> str:
        try:
            return self.module.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class CAGSTHSTValidator(ValidatorProtocol):
    def validate(self, number: str, country: str) -> str:
        number = stdnum.ca.bn.compact(number)
        if len(number) != 15:
            raise InvalidTaxID(number, country)
        try:
            return stdnum.ca.bn.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class CLTINValidator(ValidatorProtocol):
    def validate(self, number: str, country: str) -> str:
        number = stdnum.cl.rut.compact(number)
        try:
            return stdnum.cl.rut.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class TRTINValidator(ValidatorProtocol):
    def validate(self, number: str, country: str) -> str:
        number = stdnum.tr.vkn.compact(number)
        try:
            return stdnum.tr.vkn.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class INGSTValidator(ValidatorProtocol):
    def validate(self, number: str, country: str) -> str:
        number = stdnum.in_.gstin.compact(number)
        try:
            return stdnum.in_.gstin.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class VNTINValidator(ValidatorProtocol):
    def validate(self, number: str, country: str) -> str:
        number = stdnum.vn.mst.compact(number)
        try:
            return stdnum.vn.mst.validate(number)
        except stdnum.exceptions.ValidationError as e:
            raise InvalidTaxID(number, country) from e


class AETRNValidator(ValidatorProtocol):
    """
    Validator for UAE Tax Registration Number (TRN).

    The UAE TRN is a 15-digit number issued by the Federal Tax Authority.
    """

    def validate(self, number: str, country: str) -> str:
        # Remove spaces, dashes, and other common separators
        number = number.replace(" ", "").replace("-", "").replace(".", "").strip()
        # Validate: must be exactly 15 digits
        if len(number) != 15 or not number.isdigit():
            raise InvalidTaxID(number, country)
        return number


def _get_validator(tax_id_type: TaxIDFormat) -> ValidatorProtocol:
    match tax_id_type:
        case TaxIDFormat.ae_trn:
            return AETRNValidator()
        case TaxIDFormat.ca_gst_hst:
            return CAGSTHSTValidator()
        case TaxIDFormat.cl_tin:
            return CLTINValidator()
        case TaxIDFormat.tr_tin:
            return TRTINValidator()
        case TaxIDFormat.in_gst:
            return INGSTValidator()
        case TaxIDFormat.vn_tin:
            return VNTINValidator()
        case _:
            return StdNumValidator(tax_id_type)


def validate_tax_id(number: str, country: str) -> TaxID:
    """
    Validate a tax ID for a given country.

    Args:
        number: The tax ID to validate.
        country: The country of the tax ID.

    Returns:
        The validated tax ID and the tax ID format as tuple

    Raises:
        InvalidTaxID: The tax ID is invalid or unsupported.
    """
    try:
        tax_id_types = COUNTRY_TAX_ID_MAP[country]
    except KeyError as e:
        raise InvalidTaxID(number, country) from e
    else:
        for tax_id_type in tax_id_types:
            try:
                validator = _get_validator(tax_id_type)
                return validator.validate(number, country), tax_id_type
            except (UnsupportedTaxIDFormat, InvalidTaxID):
                continue
    raise InvalidTaxID(number, country)


def to_stripe_tax_id(value: TaxID) -> stripe_lib.Customer.CreateParamsTaxIdDatum:
    """
    Convert a tax ID to the format expected by Stripe.

    Args:
        value: A tuple containing the tax ID and the tax ID type.

    Returns:
        A dictionary containing the tax ID in the format expected by Stripe.
    """
    tax_id, tax_id_type = value
    return {
        "type": str(tax_id_type),  # type: ignore
        "value": tax_id,
    }


class TaxIDType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is not None:
            if not isinstance(value, tuple | list) or len(value) != 2:
                raise TypeError("Invalid tax ID value.")
            return json.dumps(value)
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return json.loads(value)
        return value


class TaxCalculationError(PolarError):
    message: LiteralString

    def __init__(
        self,
        stripe_error: stripe_lib.StripeError,
        message: LiteralString = "An error occurred while calculating tax.",
    ) -> None:
        self.stripe_error = stripe_error
        self.message = message
        super().__init__(message)


class IncompleteTaxLocation(TaxCalculationError):
    def __init__(self, stripe_error: stripe_lib.InvalidRequestError) -> None:
        super().__init__(stripe_error, "Required tax location information is missing.")


class InvalidTaxLocation(TaxCalculationError):
    def __init__(self, stripe_error: stripe_lib.StripeError) -> None:
        super().__init__(
            stripe_error,
            (
                "We could not determine the customer's tax location "
                "based on the provided customer address."
            ),
        )


class TaxabilityReason(StrEnum):
    standard_rated = "standard_rated"
    """Purchases that are subject to the standard rate of tax."""

    not_collecting = "not_collecting"
    """Purchases for countries where we don't collect tax."""

    product_exempt = "product_exempt"
    """Purchases for products that are exempt from tax."""

    reverse_charge = "reverse_charge"
    """Purchases where the customer is responsible for paying tax, e.g. B2B transactions with provided tax ID."""

    not_subject_to_tax = "not_subject_to_tax"
    """Purchases where the customer provided a tax ID, but on countries where we don't collect tax."""

    not_supported = "not_supported"
    """Purchases from countries where we don't support tax."""

    customer_exempt = "customer_exempt"
    """Purchases where the customer is exempt from tax, e.g. if the subscription was created before our tax registration."""

    @classmethod
    def from_stripe(
        cls, stripe_reason: str | None, tax_amount: int
    ) -> "TaxabilityReason | None":
        if stripe_reason is None or stripe_reason == "not_available":
            # Stripe sometimes returns `None` or `not_available` even if taxes are collected.
            if tax_amount != 0:
                return TaxabilityReason.standard_rated
            return None

        return cls(stripe_reason)


class TaxRate(TypedDict):
    rate_type: Literal["percentage"] | Literal["fixed"]
    basis_points: int | None
    amount: int | None
    amount_currency: str | None
    display_name: str
    country: str | None
    state: str | None


def from_stripe_tax_rate(tax_rate: stripe_lib.TaxRate) -> TaxRate | None:
    rate_type = tax_rate.rate_type
    if rate_type is None:
        return None

    return {
        "rate_type": "fixed" if rate_type == "flat_amount" else "percentage",
        "basis_points": int(tax_rate.percentage * 100)
        if tax_rate.percentage is not None
        else None,
        "amount": tax_rate.flat_amount.amount if tax_rate.flat_amount else None,
        "amount_currency": tax_rate.flat_amount.currency
        if tax_rate.flat_amount
        else None,
        "display_name": tax_rate.display_name,
        "country": tax_rate.country,
        "state": tax_rate.state,
    }


def from_stripe_tax_rate_details(
    tax_rate_details: stripe_lib.tax.Calculation.TaxBreakdown.TaxRateDetails,
) -> TaxRate | None:
    rate_type = tax_rate_details.rate_type
    if rate_type is None:
        return None

    basis_points = None
    amount = None
    amount_currency = None

    if tax_rate_details.percentage_decimal is not None:
        basis_points = int(float(tax_rate_details.percentage_decimal) * 100)
    elif tax_rate_details.flat_amount is not None:
        amount = tax_rate_details.flat_amount.amount
        amount_currency = tax_rate_details.flat_amount.currency

    tax_type = tax_rate_details.tax_type
    display_name = "Tax"
    if tax_type is not None:
        if tax_type in {"gst", "hst", "igst", "jct", "pst", "qct", "rst", "vat"}:
            display_name = tax_type.upper()
        else:
            display_name = tax_type.replace("_", " ").title()

    return {
        "rate_type": "fixed" if rate_type == "flat_amount" else "percentage",
        "basis_points": basis_points,
        "amount": amount,
        "amount_currency": amount_currency,
        "display_name": display_name,
        "country": tax_rate_details.country,
        "state": tax_rate_details.state,
    }


class TaxCode(StrEnum):
    general_electronically_supplied_services = (
        "general_electronically_supplied_services"
    )

    def to_stripe(self) -> str:
        match self:
            case TaxCode.general_electronically_supplied_services:
                return "txcd_10000000"


class TaxCalculation(TypedDict):
    processor_id: str
    amount: int
    taxability_reason: TaxabilityReason | None
    tax_rate: TaxRate | None


async def calculate_tax(
    identifier: uuid.UUID | str,
    currency: str,
    amount: int,
    tax_code: TaxCode,
    address: Address,
    tax_ids: list[TaxID],
    customer_exempt: bool,
) -> TaxCalculation:
    # Compute an idempotency key based on the input parameters to work as a sort of cache
    address_str = address.model_dump_json()
    tax_ids_str = ",".join(f"{tax_id[0]}:{tax_id[1]}" for tax_id in tax_ids)
    taxability_override: Literal["customer_exempt", "none"] = (
        "customer_exempt" if customer_exempt else "none"
    )
    idempotency_key_str = f"{identifier}:{currency}:{amount}:{tax_code}:{address_str}:{tax_ids_str}:{taxability_override}"
    idempotency_key = hashlib.sha256(idempotency_key_str.encode()).hexdigest()

    try:
        calculation = await stripe_service.create_tax_calculation(
            currency=currency,
            line_items=[
                {
                    "amount": amount,
                    "tax_code": tax_code.to_stripe(),
                    "quantity": 1,
                    "reference": str(identifier),
                }
            ],
            customer_details={
                "address": address.to_dict(),
                "address_source": "billing",
                "tax_ids": [to_stripe_tax_id(tax_id) for tax_id in tax_ids],
                "taxability_override": taxability_override,
            },
            idempotency_key=idempotency_key,
        )
    except stripe_lib.RateLimitError:
        if settings.is_sandbox():
            log.warning(
                "Stripe Tax API rate limit exceeded in sandbox mode, returning zero tax",
                identifier=str(identifier),
                currency=currency,
                amount=amount,
            )
            return {
                "processor_id": f"taxcalc_sandbox_{uuid.uuid4().hex}",
                "amount": 0,
                "taxability_reason": None,
                "tax_rate": None,
            }
        raise
    except stripe_lib.InvalidRequestError as e:
        if (
            e.error is not None
            and e.error.param is not None
            and e.error.param.startswith("customer_details[address]")
        ):
            raise IncompleteTaxLocation(e) from e
        raise
    except stripe_lib.StripeError as e:
        if e.error is None or e.error.code != "customer_tax_location_invalid":
            raise
        raise InvalidTaxLocation(e) from e
    else:
        assert calculation.id is not None
        amount = calculation.tax_amount_exclusive
        breakdown = calculation.tax_breakdown[0]
        return {
            "processor_id": calculation.id,
            "amount": amount,
            "taxability_reason": TaxabilityReason.from_stripe(
                breakdown.taxability_reason, amount
            ),
            "tax_rate": from_stripe_tax_rate_details(breakdown.tax_rate_details),
        }

import hashlib
import json
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, LiteralString

import stdnum.exceptions
import stripe as stripe_lib
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator
from stdnum import get_cc_module

from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.address import Address


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
        TaxIDFormat.ca_bn,
        TaxIDFormat.ca_gst_hst,
        TaxIDFormat.ca_pst_bc,
        TaxIDFormat.ca_pst_mb,
        TaxIDFormat.ca_pst_sk,
        TaxIDFormat.ca_qst,
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

TaxID = tuple[str, TaxIDFormat]


def validate_tax_id(number: str, country: str) -> TaxID:
    """
    Validate a tax ID for a given country.

    Args:
        number: The tax ID to validate.
        country: The country of the tax ID.

    Returns:
        The validated tax ID and the tax ID format as tuple

    Raises:
        ValueError: The tax ID is invalid or unsupported.
    """
    try:
        tax_id_types = COUNTRY_TAX_ID_MAP[country]
    except KeyError as e:
        raise ValueError("Unsupported country.") from e
    else:
        for tax_id_type in tax_id_types:
            tax_id_country, tax_id_format = tax_id_type.split("_", 1)
            validation_module = get_cc_module(tax_id_country, tax_id_format)
            if validation_module is None:
                continue
            try:
                validated_value = validation_module.validate(number)
                return validated_value, tax_id_type
            except stdnum.exceptions.ValidationError:
                continue
    raise ValueError("Invalid tax ID.")


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
            if not isinstance(value, tuple) or len(value) != 2:
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


async def calculate_tax(
    currency: str,
    amount: int,
    reference: str,
    stripe_product_id: str,
    address: Address,
    tax_ids: list[TaxID],
) -> int:
    # Compute an idempotency key based on the input parameters to work as a sort of cache
    address_str = address.model_dump_json()
    tax_ids_str = ",".join(f"{tax_id[0]}:{tax_id[1]}" for tax_id in tax_ids)
    idempotency_key_str = (
        f"{currency}{amount}{reference}{stripe_product_id}{address_str}{tax_ids_str}"
    )
    idempotency_key = hashlib.sha256(idempotency_key_str.encode()).hexdigest()

    try:
        calculation = await stripe_service.create_tax_calculation(
            currency=currency,
            line_items=[
                {
                    "amount": amount,
                    "product": stripe_product_id,
                    "quantity": 1,
                    "reference": reference,
                }
            ],
            customer_details={
                "address": address.to_dict(),
                "address_source": "billing",
                "tax_ids": [to_stripe_tax_id(tax_id) for tax_id in tax_ids],
            },
            idempotency_key=idempotency_key,
        )
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
        return calculation.tax_amount_exclusive

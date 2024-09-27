import json
from enum import StrEnum
from typing import Annotated, Any

import stdnum.exceptions
import stripe as stripe_lib
from pydantic import AfterValidator, Field
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator
from stdnum import get_cc_module


class TaxIdType(StrEnum):
    """
    List of supported tax ID types.

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


def validate_tax_id(value: tuple[str, TaxIdType]) -> tuple[str, TaxIdType]:
    """
    Validate a tax ID.

    Args:
        value: A tuple containing the tax ID and the tax ID type.

    Returns:
        The validated tax ID and the tax ID type as tuple

    Raises:
        ValueError: The tax ID is invalid or unsupported.
    """
    tax_id, tax_id_type = value
    country, format = tax_id_type.split("_", 1)
    validation_module = get_cc_module(country, format)
    if validation_module is None:
        raise ValueError("Unsupported tax type.")
    try:
        validated_value = validation_module.validate(tax_id)
        return validated_value, tax_id_type
    except stdnum.exceptions.ValidationError as e:
        raise ValueError("Invalid tax ID.") from e


TaxID = Annotated[
    tuple[str, TaxIdType],
    AfterValidator(validate_tax_id),
    Field(
        description=(
            "Tax ID of the customer, in the form of a couple (tax_id, tax_id_type)."
        )
    ),
]


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

from decimal import Decimal
from enum import StrEnum

from babel.numbers import format_currency as _format_currency
from babel.numbers import get_territory_currencies


class PresentmentCurrency(StrEnum):
    aed = "aed"
    all = "all"
    amd = "amd"
    aoa = "aoa"
    ars = "ars"
    aud = "aud"
    awg = "awg"
    azn = "azn"
    bam = "bam"
    bbd = "bbd"
    bdt = "bdt"
    bif = "bif"
    bmd = "bmd"
    bnd = "bnd"
    bob = "bob"
    brl = "brl"
    bsd = "bsd"
    bwp = "bwp"
    bzd = "bzd"
    cad = "cad"
    cdf = "cdf"
    chf = "chf"
    clp = "clp"
    cny = "cny"
    cop = "cop"
    crc = "crc"
    cve = "cve"
    czk = "czk"
    djf = "djf"
    dkk = "dkk"
    dop = "dop"
    dzd = "dzd"
    egp = "egp"
    etb = "etb"
    eur = "eur"
    fjd = "fjd"
    fkp = "fkp"
    gbp = "gbp"
    gel = "gel"
    gip = "gip"
    gmd = "gmd"
    gnf = "gnf"
    gtq = "gtq"
    gyd = "gyd"
    hkd = "hkd"
    hnl = "hnl"
    htg = "htg"
    huf = "huf"
    idr = "idr"
    ils = "ils"
    inr = "inr"
    isk = "isk"
    jmd = "jmd"
    jpy = "jpy"
    kes = "kes"
    kgs = "kgs"
    khr = "khr"
    kmf = "kmf"
    krw = "krw"
    kyd = "kyd"
    kzt = "kzt"
    lak = "lak"
    lkr = "lkr"
    lrd = "lrd"
    lsl = "lsl"
    mad = "mad"
    mdl = "mdl"
    mga = "mga"
    mkd = "mkd"
    mnt = "mnt"
    mop = "mop"
    mur = "mur"
    mvr = "mvr"
    mwk = "mwk"
    mxn = "mxn"
    myr = "myr"
    mzn = "mzn"
    nad = "nad"
    ngn = "ngn"
    nio = "nio"
    nok = "nok"
    npr = "npr"
    nzd = "nzd"
    pab = "pab"
    pen = "pen"
    pgk = "pgk"
    php = "php"
    pkr = "pkr"
    pln = "pln"
    pyg = "pyg"
    qar = "qar"
    ron = "ron"
    rsd = "rsd"
    rwf = "rwf"
    sar = "sar"
    sbd = "sbd"
    scr = "scr"
    sek = "sek"
    sgd = "sgd"
    shp = "shp"
    sos = "sos"
    srd = "srd"
    szl = "szl"
    thb = "thb"
    tjs = "tjs"
    top = "top"
    try_ = "try"
    ttd = "ttd"
    twd = "twd"
    tzs = "tzs"
    uah = "uah"
    ugx = "ugx"
    usd = "usd"
    uyu = "uyu"
    uzs = "uzs"
    vnd = "vnd"
    vuv = "vuv"
    wst = "wst"
    xaf = "xaf"
    xcd = "xcd"
    xcg = "xcg"
    xof = "xof"
    xpf = "xpf"
    yer = "yer"
    zar = "zar"
    zmw = "zmw"


def get_presentment_currency(country: str) -> PresentmentCurrency | None:
    """Get the presentment currency for a given country.

    Args:
        country: The country code (ISO 3166-1 alpha-2).

    Returns:
        The presentment currency or None if no supported currency is found.
    """
    try:
        currencies = get_territory_currencies(country)
    except Exception:
        return None
    for currency in currencies:
        try:
            return PresentmentCurrency(currency.lower())
        except ValueError:
            continue
    return None


_ZERO_DECIMAL_CURRENCIES: set[str] = {
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
}


def _get_currency_decimal_factor(currency: PresentmentCurrency | str) -> int:
    """Get the decimal factor for a given currency.

    Args:
        currency: The currency code.

    Returns:
        The decimal factor (e.g., 100 for usd, 1 for jpy).
    """
    if currency.lower() in _ZERO_DECIMAL_CURRENCIES:
        return 1
    else:
        return 100


def format_currency(
    amount: int | Decimal | float,
    currency: PresentmentCurrency | str,
    decimal_quantization: bool = True,
) -> str:
    """Format the currency amount.

    Handles conversion from smallest currency unit (e.g., cents) to major unit.

    Args:
        amount: The amount in the smallest currency unit (e.g., cents).
        currency: The currency code.
        decimal_quantization: Truncate and round high-precision numbers to the format pattern.

    Returns:
        The formatted currency string.
    """
    return _format_currency(
        amount / _get_currency_decimal_factor(currency),
        currency.upper(),
        locale="en_US",
        decimal_quantization=decimal_quantization,
    )


# Minimums as provided by Stripe, but with some changes on some currencies.
# Stripe indeeds enforces the source amount converted to target currency match the minimum
# of the target currency.
# Comment added for the cases where our minimum differs from Stripe's.
# Ref: https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts
MINIMUM_PRICE_PER_CURRENCY: dict[str, int] = {
    "usd": 50,
    "aed": 200,
    "ars": 50,
    "aud": 50,
    "brl": 50,
    "cad": 50,
    "chf": 50,
    "cop": 50,
    "czk": 1500,
    "dkk": 250,
    "eur": 50,
    "gbp": 30,
    "hkd": 400,
    "huf": 17500,
    "idr": 50,
    "ils": 50,
    "inr": 6000,  # 60.00 INR > 0.50 USD
    "jpy": 50,
    "krw": 800,  # 800 KRW > 0.50 USD
    "mxn": 10,
    "myr": 200,
    "nok": 300,
    "nzd": 50,
    "php": 50,
    "pln": 200,
    "ron": 200,
    "rub": 50,
    "sek": 300,
    "sgd": 50,
    "thb": 10,
    "zar": 50,
}

MINIMUM_PRICE_PER_CURRENCY_DOCSTRING = "\n".join(
    f"- {currency.upper()}: {format_currency(amount, currency)}"
    for currency, amount in MINIMUM_PRICE_PER_CURRENCY.items()
)


def get_minimum_currency_amount(currency: PresentmentCurrency | str) -> int:
    """Get the minimum price amount for a given currency.

    Args:
        currency: The currency code.

    Returns:
        The minimum price amount in the smallest currency unit.
    """
    return MINIMUM_PRICE_PER_CURRENCY.get(currency.lower(), 50)


def get_maximum_currency_amount(currency: PresentmentCurrency | str) -> int:
    """Get the maximum price amount for a given currency.

    Args:
        currency: The currency code.

    Returns:
        The maximum price amount in the smallest currency unit.
    """
    return 99999999  # TODO: Define maximum price amounts per currency

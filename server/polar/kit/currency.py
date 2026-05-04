from decimal import Decimal
from enum import StrEnum

from babel.numbers import format_currency as _format_currency
from babel.numbers import format_decimal, get_territory_currencies


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
    "all": 5000,  # 50.00 ALL > 0.50 USD
    "amd": 20000,  # 200.00 AMD > 0.50 USD
    "aoa": 50000,  # 500.00 AOA > 0.50 USD
    "ars": 75000,  # 750.00 ARS > 0.50 USD
    "aud": 70,  # 0.70 AUD > 0.50 USD
    "awg": 100,  # 1.00 AWG > 0.50 USD
    "azn": 100,  # 1.00 AZN > 0.50 USD
    "bam": 100,  # 1.00 BAM > 0.50 USD
    "bbd": 200,  # 2.00 BBD > 0.50 USD
    "bdt": 7000,  # 70.00 BDT > 0.50 USD
    "bif": 2000,  # 2000 BIF > 0.50 USD
    "bmd": 100,  # 1.00 BMD > 0.50 USD
    "bnd": 100,  # 1.00 BND > 0.50 USD
    "bob": 500,  # 5.00 BOB > 0.50 USD
    "brl": 250,  # 2.50 BRL > 0.50 USD
    "bsd": 100,  # 1.00 BSD > 0.50 USD
    "bwp": 1000,  # 10.00 BWP > 0.50 USD
    "bzd": 200,  # 2.00 BZD > 0.50 USD
    "cad": 70,  # 0.70 CAD > 0.50 USD
    "cdf": 200000,  # 2000.00 CDF > 0.50 USD
    "chf": 50,
    "clp": 500,  # 500 CLP > 0.50 USD
    "cny": 500,  # 5.00 CNY > 0.50 USD
    "cop": 200000,  # 2000.00 COP > 0.50 USD
    "crc": 30000,  # 300.00 CRC > 0.50 USD
    "cve": 5000,  # 50.00 CVE > 0.50 USD
    "czk": 1500,
    "djf": 100,  # 100 DJF > 0.50 USD
    "dkk": 320,  # 3.20 DKK > 0.50 USD
    "dop": 4000,  # 40.00 DOP > 0.50 USD
    "dzd": 7000,  # 70.00 DZD > 0.50 USD
    "egp": 3000,  # 30.00 EGP > 0.50 USD
    "etb": 8000,  # 80.00 ETB > 0.50 USD
    "eur": 50,
    "fjd": 200,  # 2.00 FJD > 0.50 USD
    "fkp": 100,  # 1.00 FKP > 0.50 USD
    "gbp": 40,  # 0.40 GBP > 0.50 USD
    "gel": 200,  # 2.00 GEL > 0.50 USD
    "gnf": 5000,  # 5000 GNF > 0.50 USD
    "gip": 100,  # 1.00 GIP > 0.50 USD
    "gmd": 4000,  # 40.00 GMD > 0.50 USD
    "gtq": 500,  # 5.00 GTQ > 0.50 USD
    "gyd": 20000,  # 200.00 GYD > 0.50 USD
    "hkd": 400,
    "hnl": 2000,  # 20.00 HNL > 0.50 USD
    "htg": 7000,  # 70.00 HTG > 0.50 USD
    "huf": 17500,
    "idr": 900000,  # 9000.00 IDR > 0.50 USD
    "ils": 150,  # 1.50 ILS > 0.50 USD
    "inr": 6000,  # 60.00 INR > 0.50 USD
    "isk": 7000,  # 70.00 ISK > 0.50 USD
    "jmd": 8000,  # 80.00 JMD > 0.50 USD
    "jpy": 80,  # 80 JPY > 0.50 USD
    "kes": 7000,  # 70.00 KES > 0.50 USD
    "kgs": 5000,  # 50.00 KGS > 0.50 USD
    "khr": 300000,  # 3000.00 KHR > 0.50 USD
    "kmf": 500,  # 500 KMF > 0.50 USD
    "krw": 800,  # 800 KRW > 0.50 USD
    "kyd": 100,  # 1.00 KYD > 0.50 USD
    "kzt": 30000,  # 300.00 KZT > 0.50 USD
    "lak": 2000000,  # 20000.00 LAK > 0.50 USD
    "lkr": 20000,  # 200.00 LKR > 0.50 USD
    "lrd": 10000,  # 100.00 LRD > 0.50 USD
    "lsl": 1000,  # 10.00 LSL > 0.50 USD
    "mad": 500,  # 5.00 MAD > 0.50 USD
    "mdl": 1000,  # 10.00 MDL > 0.50 USD
    "mga": 3000,  # 3000 MGA > 0.50 USD
    "mkd": 5000,  # 50.00 MKD > 0.50 USD
    "mnt": 200000,  # 2000.00 MNT > 0.50 USD
    "mop": 500,  # 5.00 MOP > 0.50 USD
    "mur": 5000,  # 50.00 MUR > 0.50 USD
    "mvr": 800,  # 8.00 MVR > 0.50 USD
    "mxn": 900,  # 9.00 MXN > 0.50 USD
    "mwk": 100000,  # 1000.00 MWK > 0.50 USD
    "myr": 200,
    "mzn": 5000,  # 50.00 MZN > 0.50 USD
    "nad": 1000,  # 10.00 NAD > 0.50 USD
    "ngn": 70000,  # 700.00 NGN > 0.50 USD
    "nio": 2000,  # 20.00 NIO > 0.50 USD
    "nok": 500,  # 5.00 NOK > 0.50 USD
    "npr": 8000,  # 80.00 NPR > 0.50 USD
    "nzd": 90,  # 0.90 NZD > 0.50 USD
    "pab": 100,  # 1.00 PAB > 0.50 USD
    "pen": 200,  # 2.00 PEN > 0.50 USD
    "pgk": 300,  # 3.00 PGK > 0.50 USD
    "php": 3500,  # 35.00 PHP > 0.50 USD
    "pkr": 20000,  # 200.00 PKR > 0.50 USD
    "pln": 200,
    "pyg": 4000,  # 4000 PYG > 0.50 USD
    "qar": 200,  # 2.00 QAR > 0.50 USD
    "ron": 250,  # 2.50 RON > 0.50 USD
    "rsd": 6000,  # 60.00 RSD > 0.50 USD
    "rwf": 1000,  # 1000 RWF > 0.50 USD
    "sar": 200,  # 2.00 SAR > 0.50 USD
    "sbd": 400,  # 4.00 SBD > 0.50 USD
    "scr": 800,  # 8.00 SCR > 0.50 USD
    "sek": 500,  # 5.00 SEK > 0.50 USD
    "sgd": 70,  # 0.70 SGD > 0.50 USD
    "shp": 100,  # 1.00 SHP > 0.50 USD
    "sos": 50000,  # 500.00 SOS > 0.50 USD
    "srd": 2000,  # 20.00 SRD > 0.50 USD
    "szl": 1000,  # 10.00 SZL > 0.50 USD
    "thb": 2000,  # 20.00 THB > 0.50 USD
    "tjs": 500,  # 5.00 TJS > 0.50 USD
    "top": 200,  # 2.00 TOP > 0.50 USD
    "try": 3000,  # 30.00 TRY > 0.50 USD
    "ttd": 400,  # 4.00 TTD > 0.50 USD
    "twd": 2000,  # 20.00 TWD > 0.50 USD
    "tzs": 200000,  # 2000.00 TZS > 0.50 USD
    "uah": 3000,  # 30.00 UAH > 0.50 USD
    "ugx": 2000,  # 2000 UGX > 0.50 USD
    "uyu": 2000,  # 20.00 UYU > 0.50 USD
    "uzs": 700000,  # 7000.00 UZS > 0.50 USD
    "vnd": 20000,  # 20000 VND > 0.50 USD
    "vuv": 100,  # 100 VUV > 0.50 USD
    "wst": 200,  # 2.00 WST > 0.50 USD
    "xaf": 500,  # 500 XAF > 0.50 USD
    "xcd": 200,  # 2.00 XCD > 0.50 USD
    "xcg": 100,  # 1.00 XCG > 0.50 USD
    "xof": 500,  # 500 XOF > 0.50 USD
    "xpf": 100,  # 100 XPF > 0.50 USD
    "yer": 20000,  # 200.00 YER > 0.50 USD
    "zar": 900,  # 9.00 ZAR > 0.50 USD
    "zmw": 1000,  # 10.00 ZMW > 0.50 USD
}

MINIMUM_PRICE_PER_CURRENCY_DOCSTRING = "\n".join(
    f"- {currency.upper()}: {format_decimal(amount / _get_currency_decimal_factor(currency), locale='en_US', decimal_quantization=False)}"
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

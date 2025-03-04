from datetime import datetime as dt

from babel.numbers import format_currency


def datetime(value: dt) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def currency(value: int, currency: str) -> str:
    return format_currency(value / 100, currency.upper(), locale="en_US")

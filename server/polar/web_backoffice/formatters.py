from datetime import datetime as dt

from babel.numbers import format_currency

from polar.kit.tax import TaxID


def datetime(value: dt) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S")


def currency(value: int, currency: str) -> str:
    return format_currency(value / 100, currency.upper(), locale="en_US")


def tax_id(value: TaxID) -> str:
    number, format = value
    return f"{format.replace('_', ' ').upper()} {number}"


def file_size(size_bytes: int) -> str:
    """Format file size in bytes to human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"

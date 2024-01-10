import csv
from collections.abc import Iterable
from typing import BinaryIO

from email_validator import EmailNotValidError, validate_email


def get_iterable_from_binary_io(file: BinaryIO) -> Iterable[str]:
    for line in file:
        yield line.decode("utf-8")


def get_emails_from_csv(lines: Iterable[str]) -> set[str]:
    emails: set[str] = set()

    reader = csv.DictReader(lines)
    if reader.fieldnames is None:
        return emails

    try:
        email_field = next(
            field for field in reader.fieldnames if "email" in field.lower()
        )
    except StopIteration:
        return emails

    for row in reader:
        email = row.get(email_field)
        if email is not None:
            try:
                validate_email(email, check_deliverability=False)
            except EmailNotValidError:
                continue
            else:
                emails.add(email)

    return emails

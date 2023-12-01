import csv


def get_emails_from_csv(contents: str) -> list[str]:
    reader = csv.DictReader(contents.splitlines())

    res: list[str] = [
        e
        for e in [
            # get with fallback
            row.get("email", None)
            or row.get("EMAIL", None)
            or row.get("Email", None)
            or None
            for row in reader
        ]
        if e and "@" in e
    ]
    return res

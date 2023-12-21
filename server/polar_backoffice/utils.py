from datetime import datetime, tzinfo


def system_timezone() -> tzinfo | None:
    return datetime.now().astimezone().tzinfo

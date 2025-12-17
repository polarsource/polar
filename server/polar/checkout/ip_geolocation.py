import argparse
import sys
from typing import Annotated, cast

import ipinfo_db
import ipinfo_db.reader
from fastapi import Depends, Request

from polar.config import settings

DATABASE_PATH = (
    settings.IP_GEOLOCATION_DATABASE_DIRECTORY_PATH
    / settings.IP_GEOLOCATION_DATABASE_NAME
)


async def _get_client_dependency(request: Request) -> "IPGeolocationClient | None":
    """
    Retrieve the IPInfo database client from the FastAPI request state.
    """
    return request.state.ip_geolocation_client


IPGeolocationClient = Annotated[ipinfo_db.Client, Depends(_get_client_dependency)]


def _download_database(access_token: str) -> None:
    """
    Download the IP to Country ASN database.

    This should not be called when starting the server or during a request but
    at build time.

    Args:
        access_token: IPInfo access token.
    """
    client = ipinfo_db.Client(access_token, DATABASE_PATH, replace=True)
    client.close()


def get_client() -> IPGeolocationClient:
    """
    Open the IP to Country ASN database.

    Returns:
        IPInfo database client.
    """
    if not DATABASE_PATH.exists():
        raise FileNotFoundError(
            f"Database not found at {DATABASE_PATH}. "
            "Please run `python -m polar.checkout.ip_geolocation ACCESS_TOKEN`."
        )
    return ipinfo_db.Client(path=DATABASE_PATH)


def get_ip_country(client: IPGeolocationClient, ip: str) -> str | None:
    """
    Get the country alpha-2 code for the given IP address, if available.

    Args:
        client: IPInfo database client.
        ip: IP address.

    Returns:
        Country alpha-2 code.
    """
    ret = cast(str | None, client.getCountry(ip))
    # Convert empty str into None response to ease empty case checking
    if ret == "":
        return None
    return ret


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download the IP to Country ASN database."
    )
    parser.add_argument("access_token", type=str, help="IPInfo access token")
    args = parser.parse_args()

    _download_database(args.access_token)
    sys.stdout.write(f"Database downloaded to {DATABASE_PATH}\n")

__all__ = ["IPGeolocationClient", "get_client", "get_ip_country"]

import argparse
import sys
from typing import cast

import httpx
import ipinfo_db

from polar.config import settings

DOWNLOAD_PATH = "https://ipinfo.io/data/free/country_asn.mmdb?token={token}"
DATABASE_PATH = (
    settings.IP_GEOLOCATION_DATABASE_DIRECTORY_PATH
    / settings.IP_GEOLOCATION_DATABASE_NAME
)


def _download_database(access_token: str) -> None:
    """
    Download the IP to Country ASN database.

    This should not be called when starting the server or during a request but
    at build time.

    Args:
        access_token: IPInfo access token.
    """
    with open(DATABASE_PATH, "wb") as db_file:
        with httpx.Client() as http_client:
            with http_client.stream(
                "GET", DOWNLOAD_PATH.format(token=access_token), follow_redirects=True
            ) as response:
                response.raise_for_status()
                db_file.writelines(response.iter_bytes())


class IPGeolocation:
    def __init__(self) -> None:
        self._client: ipinfo_db.Client | None = None

    def open(self) -> None:
        """
        Open the IP to Country ASN database.

        Raises:
            FileNotFoundError: The database hasn't been downloaded.
        """
        if not DATABASE_PATH.exists():
            raise FileNotFoundError(
                f"Database not found at {DATABASE_PATH}. "
                "Please run `python -m polar.checkout.ip_geolocation ACCESS_TOKEN`."
            )
        self._client = ipinfo_db.Client(path=DATABASE_PATH)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def get_country(self, ip: object | None) -> str | None:
        """
        Get the country alpha-2 code for the given IP address, if available.

        Returns None if the database isn't open or the IP can't be geolocated.
        """
        if self._client is None or ip is None:
            return None
        try:
            country = cast(str | None, self._client.getCountry(str(ip)))
        except ValueError:
            return None
        return country or None


ip_geolocation = IPGeolocation()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Download the IP to Country ASN database."
    )
    parser.add_argument("access_token", type=str, help="IPInfo access token")
    args = parser.parse_args()

    _download_database(args.access_token)
    sys.stdout.write(f"Database downloaded to {DATABASE_PATH}\n")

__all__ = ["IPGeolocation", "ip_geolocation"]

from unittest.mock import MagicMock

from polar.checkout.ip_geolocation import get_ip_country


def test_get_ip_country() -> None:
    client = MagicMock()

    client.getCountry.return_value = "FR"
    assert get_ip_country(client, "8.8.8.8") == "FR"

    client.getCountry.return_value = ""
    assert get_ip_country(client, "8.8.8.8") is None

    client.getCountry.side_effect = ValueError("invalid ip")
    assert get_ip_country(client, "invalid-ip") is None

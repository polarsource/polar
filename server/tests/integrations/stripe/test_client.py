import subprocess
import sys
import textwrap

import pytest


class TestStripeTLS:
    @pytest.mark.parametrize(
        "modules",
        [
            (
                "polar.integrations.stripe.service",
                "polar.merchant_migration.adapters.stripe",
            ),
            (
                "polar.merchant_migration.adapters.stripe",
                "polar.integrations.stripe.service",
            ),
        ],
    )
    def test_clients_use_certifi_in_either_import_order(
        self, modules: tuple[str, str]
    ) -> None:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                textwrap.dedent(
                    """\
                    import importlib
                    import ssl
                    import sys

                    import certifi
                    import stripe

                    importlib.import_module("polar.integrations.stripe")
                    assert "polar.integrations.stripe.service" not in sys.modules
                    assert stripe.ca_bundle_path == certifi.where()

                    expected_roots = ssl.create_default_context(
                        cafile=certifi.where()
                    ).get_ca_certs(binary_form=True)

                    for name in sys.argv[1:]:
                        module = importlib.import_module(name)
                        assert stripe.ca_bundle_path == certifi.where()
                        if hasattr(module, "StripeAdapter"):
                            client = module.StripeAdapter("rk_test")._client
                            transport = client._requestor._client
                            assert transport._verify_ssl_certs
                            transport = transport._async_fallback_client
                        else:
                            transport = module.stripe_http_client
                            assert transport is stripe.default_http_client
                            assert module.stripe_risk_client._requestor._client is transport
                        assert transport._verify_ssl_certs
                        for client in (transport._client, transport._client_async):
                            if client is None:
                                continue
                            context = client._transport._pool._ssl_context
                            assert context.verify_mode == ssl.CERT_REQUIRED
                            assert context.check_hostname
                            assert context.get_ca_certs(binary_form=True) == expected_roots
                    """
                ),
                *modules,
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0, result.stdout + result.stderr

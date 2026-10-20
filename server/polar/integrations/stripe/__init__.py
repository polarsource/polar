import certifi
import stripe as stripe_lib

__all__ = ["stripe_lib"]

stripe_lib.ca_bundle_path = certifi.where()

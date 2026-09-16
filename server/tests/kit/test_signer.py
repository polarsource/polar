import pytest
from authlib.jose import JsonWebKey
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

from polar.config import Environment, settings
from polar.kit import signer
from polar.kit.signer import KMSSigner, LocalSigner


def test_local_signature_verifies_against_the_published_key() -> None:
    local = LocalSigner(settings.JWKS, settings.CURRENT_JWK_KID)
    signing_input = b"header.claims"

    signature = local.sign(signing_input)

    published = JsonWebKey.import_key(local.public_jwk())
    published.get_public_key().verify(
        signature, signing_input, padding.PKCS1v15(), hashes.SHA256()
    )


def test_local_signer_publishes_only_the_public_key() -> None:
    local = LocalSigner(settings.JWKS, settings.CURRENT_JWK_KID)

    published = local.public_jwk()

    assert published["kid"] == settings.CURRENT_JWK_KID
    assert {"kty", "n", "e"}.issubset(published)
    assert not {"d", "p", "q", "dp", "dq", "qi", "oth"} & set(published)


def test_kms_kid_is_the_key_id_not_the_arn() -> None:
    kms = KMSSigner("arn:aws:kms:us-east-2:123456789012:key/2f5a7b1c")

    assert kms.kid == "2f5a7b1c"


def test_get_signer_requires_the_kms_key_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", Environment.production)
    monkeypatch.setattr(settings, "AWS_JWKS_KMS_KEY_ID", None)

    with pytest.raises(RuntimeError, match="POLAR_AWS_JWKS_KMS_KEY_ID"):
        signer.get_signer()


def test_get_signer_follows_a_moved_current_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", Environment.production)
    monkeypatch.setattr(settings, "AWS_JWKS_KMS_KEY_ID", "2f5a7b1c")
    assert signer.get_signer().kid == "2f5a7b1c"

    monkeypatch.setattr(settings, "AWS_JWKS_KMS_KEY_ID", "8d3e9a4f")
    assert signer.get_signer().kid == "8d3e9a4f"

import pytest
from cryptography.exceptions import InvalidTag

from polar.config import Environment, settings
from polar.kit import encryption
from polar.kit.encryption import (
    EncryptedString,
    EncryptedStringType,
    LocalKeyProvider,
)

CONTEXT = {"table": "slack_apps", "column": "bot_token"}


@pytest.mark.asyncio
async def test_encrypt_decrypt_roundtrip() -> None:
    secret = await EncryptedString.encrypt("xoxb-1234", context=CONTEXT)
    assert secret.encrypted_value.startswith("v1.")
    assert "xoxb-1234" not in secret.encrypted_value
    assert await secret.decrypt() == "xoxb-1234"


@pytest.mark.asyncio
async def test_each_encryption_uses_a_fresh_data_key() -> None:
    first = await EncryptedString.encrypt("same", context=CONTEXT)
    second = await EncryptedString.encrypt("same", context=CONTEXT)
    assert first.encrypted_value != second.encrypted_value


@pytest.mark.asyncio
async def test_context_binds_ciphertext_to_its_row() -> None:
    encrypted = await EncryptedString.encrypt(
        "xoxb-1234", context={**CONTEXT, "id": "row-1"}
    )
    # A loaded row only carries the static context; the caller supplies the id.
    loaded = EncryptedString(encrypted.encrypted_value, CONTEXT)

    assert await loaded.decrypt(id="row-1") == "xoxb-1234"

    with pytest.raises(InvalidTag):
        await loaded.decrypt(id="row-2")

    with pytest.raises(InvalidTag):
        await loaded.decrypt()


@pytest.mark.asyncio
async def test_tampered_ciphertext_fails_closed() -> None:
    secret = await EncryptedString.encrypt("xoxb-1234", context=CONTEXT)
    version, wrapped, nonce, ciphertext = secret.encrypted_value.split(".")
    tampered = EncryptedString(
        ".".join((version, wrapped, nonce, ciphertext[:-4] + "AAAA")), CONTEXT
    )
    with pytest.raises(InvalidTag):
        await tampered.decrypt()


@pytest.mark.asyncio
async def test_unsupported_version_raises() -> None:
    secret = await EncryptedString.encrypt("xoxb-1234", context=CONTEXT)
    _, rest = secret.encrypted_value.split(".", 1)
    with pytest.raises(ValueError, match="Unsupported encryption version"):
        await EncryptedString(f"v2.{rest}", CONTEXT).decrypt()


def test_str_never_leaks_and_repr_hides_the_secret() -> None:
    secret = EncryptedString("v1.aaa.bbb.ccc", CONTEXT)
    assert str(secret) == "<encrypted>"
    assert repr(secret) == f'EncryptedString("***", {CONTEXT!r})'
    assert "aaa.bbb.ccc" not in str(secret)
    assert "aaa.bbb.ccc" not in repr(secret)


def test_context_is_copied_not_aliased() -> None:
    context = {"table": "t", "column": "c"}
    secret = EncryptedString("v1.a.b.c", context)
    context["column"] = "mutated"
    assert secret.context == {"table": "t", "column": "c"}


@pytest.mark.asyncio
async def test_local_key_provider_rejects_wrong_context() -> None:
    provider = LocalKeyProvider("local-key")
    _, wrapped = await provider.generate_data_key(CONTEXT)
    with pytest.raises(InvalidTag):
        await provider.decrypt_data_key(wrapped, {**CONTEXT, "id": "other"})


def test_type_unboxes_encrypted_string_on_write() -> None:
    type_ = EncryptedStringType(CONTEXT)
    secret = EncryptedString("v1.a.b.c", CONTEXT)
    assert type_.process_bind_param(secret, None) == "v1.a.b.c"  # type: ignore[arg-type]
    assert type_.process_bind_param(None, None) is None  # type: ignore[arg-type]


def test_type_rejects_raw_string_on_write() -> None:
    type_ = EncryptedStringType(CONTEXT)
    with pytest.raises(ValueError, match="encrypt the value before assigning it"):
        type_.process_bind_param("plaintext", None)  # type: ignore[arg-type]


def test_type_boxes_ciphertext_on_read() -> None:
    type_ = EncryptedStringType(CONTEXT)
    boxed = type_.process_result_value("v1.a.b.c", None)  # type: ignore[arg-type]
    assert isinstance(boxed, EncryptedString)
    assert boxed.encrypted_value == "v1.a.b.c"
    assert boxed.context == CONTEXT
    assert type_.process_result_value(None, None) is None  # type: ignore[arg-type]


def test_type_context_distinguishes_statement_cache_keys() -> None:
    # The per-column context must be part of the SQLAlchemy statement cache
    # key; otherwise two encrypted columns collide and decrypt with the wrong
    # context.
    a = EncryptedStringType({"table": "t", "column": "a"})
    b = EncryptedStringType({"table": "t", "column": "b"})
    assert a.cache_ok is True
    assert (
        a._static_cache_key
        == EncryptedStringType({"table": "t", "column": "a"})._static_cache_key
    )
    assert a._static_cache_key != b._static_cache_key


def test_get_key_provider_requires_kms_key_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ENV", Environment.production)
    monkeypatch.setattr(settings, "AWS_KMS_KEY_ID", None)
    encryption.get_key_provider.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="POLAR_AWS_KMS_KEY_ID"):
            encryption.get_key_provider()
    finally:
        encryption.get_key_provider.cache_clear()

from polar.kit.crypto import generate_token, validate_token_checksum


class TestValidateTokenChecksum:
    def test_valid_checksum(self) -> None:
        prefix = "polar_pat_"
        token = generate_token(prefix=prefix)
        assert validate_token_checksum(token, prefix=prefix) is True

    def test_invalid_checksum_tampered(self) -> None:
        prefix = "polar_pat_"
        token = generate_token(prefix=prefix)
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        assert validate_token_checksum(tampered, prefix=prefix) is False

    def test_wrong_prefix(self) -> None:
        token = generate_token(prefix="polar_pat_")
        assert validate_token_checksum(token, prefix="polar_oat_") is False

    def test_token_too_short(self) -> None:
        prefix = "polar_pat_"
        short_token = prefix + "a" * 32
        assert validate_token_checksum(short_token, prefix=prefix) is False

    def test_token_too_long(self) -> None:
        prefix = "polar_pat_"
        long_token = generate_token(prefix=prefix) + "extra"
        assert validate_token_checksum(long_token, prefix=prefix) is False

    def test_different_prefixes(self) -> None:
        prefixes = ["polar_pat_", "polar_oat_", "polar_cst_", "polar_at_u_"]
        for prefix in prefixes:
            token = generate_token(prefix=prefix)
            assert validate_token_checksum(token, prefix=prefix) is True

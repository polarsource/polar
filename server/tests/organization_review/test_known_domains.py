from polar.organization_review.known_domains import (
    KNOWN_DOMAINS,
    KnownDomain,
    known_domains_for_prompt,
    match_known_domain,
)


class TestKnownDomainMatches:
    def test_exact_match(self) -> None:
        kd = KnownDomain("discord.com", "Discord", "messaging")
        assert kd.matches("discord.com") is True

    def test_exact_no_match(self) -> None:
        kd = KnownDomain("discord.com", "Discord", "messaging")
        assert kd.matches("other.com") is False

    def test_wildcard_match(self) -> None:
        kd = KnownDomain("*.supabase.co", "Supabase", "backend")
        assert kd.matches("abcdef.supabase.co") is True

    def test_wildcard_no_match_bare_root(self) -> None:
        """The bare root should NOT match a wildcard pattern."""
        kd = KnownDomain("*.supabase.co", "Supabase", "backend")
        assert kd.matches("supabase.co") is False

    def test_wildcard_no_match_different_domain(self) -> None:
        kd = KnownDomain("*.supabase.co", "Supabase", "backend")
        assert kd.matches("evil.com") is False

    def test_wildcard_safety_no_suffix_trick(self) -> None:
        """Ensure evil-supabase.co does NOT match *.supabase.co."""
        kd = KnownDomain("*.supabase.co", "Supabase", "backend")
        assert kd.matches("evil-supabase.co") is False

    def test_exact_pattern_not_wildcard(self) -> None:
        kd = KnownDomain("hooks.slack.com", "Slack", "messaging")
        assert kd.matches("hooks.slack.com") is True
        assert kd.matches("evil.hooks.slack.com") is False


class TestMatchKnownDomain:
    def test_returns_matching_entry(self) -> None:
        result = match_known_domain("discord.com")
        assert result is not None
        assert result.name == "Discord"

    def test_returns_none_for_unknown(self) -> None:
        assert match_known_domain("unknown-domain.example.com") is None

    def test_wildcard_returns_entry(self) -> None:
        result = match_known_domain("myproject.supabase.co")
        assert result is not None
        assert result.name == "Supabase"


class TestKnownDomainsForPrompt:
    def test_non_empty(self) -> None:
        result = known_domains_for_prompt()
        assert len(result) > 0

    def test_contains_all_entries(self) -> None:
        result = known_domains_for_prompt()
        for kd in KNOWN_DOMAINS:
            assert kd.pattern in result
            assert kd.name in result

import pytest

from polar.benefit.strategies.slack_shared_channel.template import (
    InvalidTemplateError,
    TemplateContext,
    render_channel_name,
    validate_template,
)


class TestValidateTemplate:
    def test_fixed_placeholders(self) -> None:
        validate_template("support-{customer_name}")
        validate_template("{customer_email_local}")

    def test_metadata_placeholder(self) -> None:
        validate_template("{metadata.tier}-{customer_name}")

    def test_unknown_placeholder(self) -> None:
        with pytest.raises(InvalidTemplateError, match="organization_slug"):
            validate_template("{organization_slug}-x")

    def test_metadata_without_key(self) -> None:
        with pytest.raises(InvalidTemplateError, match="metadata"):
            validate_template("{metadata.}")

    @pytest.mark.parametrize(
        "template",
        [
            "support-{customer_name",
            "support-customer_name}",
            "support-{customer-name}",
            "support-{}",
            "support-{{customer_name}}",
        ],
    )
    def test_malformed_placeholder_raises(self, template: str) -> None:
        with pytest.raises(InvalidTemplateError, match="Malformed placeholder"):
            validate_template(template)

    def test_empty_renders_against_sample(self) -> None:
        with pytest.raises(InvalidTemplateError, match="empty"):
            validate_template("---")

    def test_literal_only(self) -> None:
        validate_template("support")


class TestRenderChannelName:
    def test_fixed_placeholders(self) -> None:
        context = TemplateContext(
            customer_name="Acme Inc.",
            customer_email_local="admin",
        )
        assert (
            render_channel_name("support-{customer_name}", context)
            == "support-acme-inc"
        )
        assert render_channel_name("{customer_email_local}", context) == "admin"

    def test_metadata_lookup(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"tier": "gold"},
        )
        assert render_channel_name("{metadata.tier}-acme", context) == "gold-acme"

    def test_metadata_lookup_with_hyphenated_key(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"plan-name": "gold"},
        )
        validate_template("{metadata.plan-name}-{customer_name}")
        assert (
            render_channel_name("{metadata.plan-name}-{customer_name}", context)
            == "gold-acme"
        )

    def test_metadata_lookup_with_dotted_key(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"plan.name": "gold"},
        )
        validate_template("{metadata.plan.name}-{customer_name}")
        assert (
            render_channel_name("{metadata.plan.name}-{customer_name}", context)
            == "gold-acme"
        )

    def test_metadata_lookup_with_space_key(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"plan name": "gold"},
        )
        validate_template("{metadata.plan name}-{customer_name}")
        assert (
            render_channel_name("{metadata.plan name}-{customer_name}", context)
            == "gold-acme"
        )

    def test_metadata_lookup_with_colon_key(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"tier:level": "gold"},
        )
        validate_template("{metadata.tier:level}")
        assert render_channel_name("{metadata.tier:level}", context) == "gold"

    def test_metadata_missing_key_raises(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={},
        )
        with pytest.raises(InvalidTemplateError, match="metadata key 'tier'"):
            render_channel_name("{metadata.tier}", context)

    def test_metadata_dotted_key_missing_raises(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"plan": "gold"},
        )
        with pytest.raises(InvalidTemplateError, match="metadata key 'plan.name'"):
            render_channel_name("{metadata.plan.name}", context)

    def test_metadata_dotted_key_does_not_traverse(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="admin",
            metadata={"plan": "gold", "name": "team"},
        )
        with pytest.raises(InvalidTemplateError, match="metadata key 'plan.name'"):
            render_channel_name("{metadata.plan.name}", context)

    def test_slugify_lowercase_and_dashes(self) -> None:
        context = TemplateContext(
            customer_name="Hello WORLD!",
            customer_email_local="x",
        )
        assert render_channel_name("{customer_name}", context) == "hello-world"

    def test_truncates_to_80_chars(self) -> None:
        context = TemplateContext(
            customer_name="x" * 200,
            customer_email_local="x",
        )
        rendered = render_channel_name("{customer_name}", context)
        assert len(rendered) == 80

    def test_suffix_appended(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="x",
        )
        assert (
            render_channel_name("{customer_name}", context, suffix="abcd")
            == "acme-abcd"
        )

    def test_suffix_survives_truncation(self) -> None:
        context = TemplateContext(
            customer_name="x" * 200,
            customer_email_local="x",
        )
        rendered = render_channel_name("{customer_name}", context, suffix="abcd")
        assert len(rendered) == 80
        assert rendered.endswith("-abcd")

    def test_tolerant_substitutes_missing_metadata_with_key(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="x",
            metadata={},
        )
        assert (
            render_channel_name("support-{metadata.slug}", context, tolerant=True)
            == "support-slug"
        )

    def test_strips_trailing_dashes(self) -> None:
        context = TemplateContext(
            customer_name="Acme!!!",
            customer_email_local="x",
        )
        assert render_channel_name("{customer_name}", context) == "acme"

    def test_empty_runtime_channel_name_raises(self) -> None:
        context = TemplateContext(
            customer_name="李雷",
            customer_email_local="李雷",
        )
        with pytest.raises(InvalidTemplateError, match="empty channel name"):
            render_channel_name("{customer_name}", context)

    def test_malformed_placeholder_raises(self) -> None:
        context = TemplateContext(
            customer_name="Acme",
            customer_email_local="x",
        )
        with pytest.raises(InvalidTemplateError, match="Malformed placeholder"):
            render_channel_name("support-{customer-name}", context)

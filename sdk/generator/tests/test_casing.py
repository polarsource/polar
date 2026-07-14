import pytest

from generator.casing import to_camel_case, to_pascal_case, to_snake_case


class TestToSnakeCase:
    @pytest.mark.parametrize(
        "input_str,expected",
        [
            # Basic cases
            ("what_if", "what_if"),
            ("whatIf", "what_if"),
            ("WhatIf", "what_if"),
            ("what-if", "what_if"),
            # The bug case: hyphen followed by uppercase
            ("What-If", "what_if"),
            ("get-User", "get_user"),
            ("My-HTTP-Response", "my_http_response"),
            # Multiple hyphens
            ("my-http-response", "my_http_response"),
            ("get-user-info", "get_user_info"),
            # All uppercase
            ("HTTPResponse", "http_response"),
            ("APIKey", "api_key"),
            # Single word
            ("word", "word"),
            ("Word", "word"),
            ("WORD", "word"),
            # Empty and edge cases
            ("", ""),
            ("-", "_"),
            ("--", "__"),
            # Mixed cases
            ("getUserID", "get_user_id"),
            ("GetUser-ID", "get_user_id"),
            ("get-UserID", "get_user_id"),
            # Consecutive uppercase (acronyms)
            ("HTTPAPI", "httpapi"),
            ("HTTPSConnection", "https_connection"),
            # Already snake_case
            ("already_snake_case", "already_snake_case"),
            ("_leading_underscore", "_leading_underscore"),
            ("trailing_underscore_", "trailing_underscore_"),
        ],
    )
    def test_to_snake_case(self, input_str, expected):
        assert to_snake_case(input_str) == expected


class TestToPascalCase:
    @pytest.mark.parametrize(
        "input_str,expected",
        [
            ("what_if", "WhatIf"),
            ("what_if_test", "WhatIfTest"),
            ("a", "A"),
            ("", ""),
            ("_leading", "Leading"),
            ("trailing_", "Trailing"),
            ("__double__", "Double"),
        ],
    )
    def test_to_pascal_case(self, input_str, expected):
        assert to_pascal_case(input_str) == expected


class TestToCamelCase:
    @pytest.mark.parametrize(
        "input_str,expected",
        [
            ("what_if", "whatIf"),
            ("what_if_test", "whatIfTest"),
            ("a", "a"),
            ("", ""),
            (
                "_leading",
                "Leading",
            ),  # First empty part becomes empty string, rest capitalized
            ("trailing_", "trailing"),
            ("__double__", "Double"),  # Multiple empty parts, rest capitalized
            ("WhatIf", "whatIf"),
            ("PascalCase", "pascalCase"),
        ],
    )
    def test_to_camel_case(self, input_str, expected):
        assert to_camel_case(input_str) == expected

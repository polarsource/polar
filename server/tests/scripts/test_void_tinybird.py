from unittest.mock import MagicMock, patch

from scripts import void_tinybird


class TestLocalBuild:
    def test_shared_build_includes_polar_and_void_resources(self) -> None:
        response = MagicMock()
        response.json.return_value = {"result": "success"}
        with (
            patch.object(void_tinybird, "get_token", return_value="local-token"),
            patch.object(void_tinybird, "settings") as settings,
            patch.object(void_tinybird.httpx, "Client") as client,
        ):
            settings.VOID_TINYBIRD_API_URL = "http://localhost:7181"
            settings.is_development.return_value = True
            client.return_value.__enter__.return_value.post.return_value = response
            void_tinybird.deploy(local=True, shared=True)
            files = client.return_value.__enter__.return_value.post.call_args.kwargs[
                "files"
            ]

        names = {content[0] for _, content in files}
        assert "events_by_ingested_at.datasource" in names
        assert "void_events.datasource" in names
        assert "metrics_events.pipe" in names
        assert "void_events_list.pipe" in names

from polar.integrations.aws.s3.schemas import get_downloadable_content_disposition


class TestGetDownloadableContentDisposition:
    def test_pure_ascii(self) -> None:
        assert (
            get_downloadable_content_disposition("hello.mp3")
            == 'attachment; filename="hello.mp3"'
        )

    def test_non_latin1_character(self) -> None:
        result = get_downloadable_content_disposition("Sample\u2019s Filename.mp3")
        assert result == (
            'attachment; filename="Samples Filename.mp3"; '
            "filename*=UTF-8''Sample%E2%80%99s%20Filename.mp3"
        )
        assert result.encode("latin-1")

    def test_latin1_character(self) -> None:
        result = get_downloadable_content_disposition("café.mp3")
        assert result == (
            "attachment; filename=\"cafe.mp3\"; filename*=UTF-8''caf%C3%A9.mp3"
        )
        assert result.encode("latin-1")

    def test_shift_jis_character(self) -> None:
        result = get_downloadable_content_disposition("サンプル.mp3")
        assert result == (
            'attachment; filename=".mp3"; '
            "filename*=UTF-8''%E3%82%B5%E3%83%B3%E3%83%97%E3%83%AB.mp3"
        )
        assert result.encode("latin-1")

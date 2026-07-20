from polar.integrations.aws.s3.schemas import (
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
)


class TestS3FileUploadCompletedPart:
    def test_checksum_etag_trailing_carriage_return_is_stripped(self) -> None:
        part = S3FileUploadCompletedPart(
            number=1,
            checksum_etag='"abc123"\r',
            checksum_sha256_base64=None,
        )

        assert part.checksum_etag == '"abc123"'

    def test_checksum_etag_surrounding_whitespace_is_stripped(self) -> None:
        part = S3FileUploadCompletedPart(
            number=1,
            checksum_etag='  \t"abc123"\n ',
            checksum_sha256_base64=None,
        )

        assert part.checksum_etag == '"abc123"'

    def test_stripped_checksum_etag_reaches_boto3_arguments(self) -> None:
        completed = S3FileUploadCompleted(
            id="upload-id",
            path="path/to/file",
            parts=[
                S3FileUploadCompletedPart(
                    number=1,
                    checksum_etag='"abc123"\r',
                    checksum_sha256_base64=None,
                )
            ],
        )

        arguments = completed.get_boto3_arguments()

        assert arguments["MultipartUpload"]["Parts"][0]["ETag"] == '"abc123"'

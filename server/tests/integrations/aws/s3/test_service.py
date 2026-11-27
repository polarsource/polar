from unittest.mock import MagicMock

import pytest
from botocore.client import ClientError

from polar.exceptions import NotPermitted
from polar.integrations.aws.s3.exceptions import S3FileError
from polar.integrations.aws.s3.schemas import S3FileUploadCompleted
from polar.integrations.aws.s3.service import S3Service


class TestCompleteMultipartUpload:
    def test_completion_retry_after_abort_is_forbidden(self) -> None:
        client = MagicMock()
        client.complete_multipart_upload.side_effect = ClientError(
            {"Error": {"Code": "NoSuchUpload"}}, "CompleteMultipartUpload"
        )
        service = S3Service(bucket="bucket", client=client)
        completion = S3FileUploadCompleted(id="upload", path="file.pdf", parts=[])

        with pytest.raises(
            NotPermitted, match="Multipart upload is no longer available"
        ):
            service.complete_multipart_upload(completion, path="file.pdf", size=1)

        client.abort_multipart_upload.assert_not_called()

    @pytest.mark.parametrize("abort_fails", [False, True])
    def test_invalid_completion_aborts_upload(self, abort_fails: bool) -> None:
        client = MagicMock()
        error = ClientError(
            {"Error": {"Code": "InvalidRequest"}}, "CompleteMultipartUpload"
        )
        client.complete_multipart_upload.side_effect = error
        if abort_fails:
            client.abort_multipart_upload.side_effect = ClientError(
                {"Error": {"Code": "AccessDenied"}}, "AbortMultipartUpload"
            )

        service = S3Service(bucket="bucket", client=client)
        completion = S3FileUploadCompleted(id="upload", path="file.pdf", parts=[])
        with pytest.raises(NotPermitted) as exc_info:
            service.complete_multipart_upload(completion, path="file.pdf", size=1)

        assert exc_info.value.__cause__ is error
        client.abort_multipart_upload.assert_called_once_with(
            Bucket="bucket", Key="file.pdf", UploadId="upload"
        )

    def test_other_errors_remain_unchanged(self) -> None:
        client = MagicMock()
        error = ClientError(
            {"Error": {"Code": "InvalidPart"}}, "CompleteMultipartUpload"
        )
        client.complete_multipart_upload.side_effect = error
        service = S3Service(bucket="bucket", client=client)
        completion = S3FileUploadCompleted(id="upload", path="file.pdf", parts=[])

        with pytest.raises(ClientError) as exc_info:
            service.complete_multipart_upload(completion, path="file.pdf", size=1)

        assert exc_info.value is error
        client.abort_multipart_upload.assert_not_called()


class TestGetObjectOrRaise:
    def test_omits_empty_version_id(self) -> None:
        client = MagicMock()
        client.get_object.return_value = {"Body": b"pdf"}

        result = S3Service(bucket="bucket", client=client).get_object_or_raise(
            "support_case_attachment/file.pdf"
        )

        assert result == {"Body": b"pdf"}
        client.get_object.assert_called_once_with(
            Bucket="bucket",
            Key="support_case_attachment/file.pdf",
            ChecksumMode="ENABLED",
        )

    def test_passes_version_id(self) -> None:
        client = MagicMock()
        client.get_object.return_value = {"Body": b"pdf"}

        S3Service(bucket="bucket", client=client).get_object_or_raise(
            "path/file.pdf", s3_version_id="v1"
        )

        client.get_object.assert_called_once_with(
            Bucket="bucket",
            Key="path/file.pdf",
            VersionId="v1",
            ChecksumMode="ENABLED",
        )

    def test_preserves_s3_error(self) -> None:
        client = MagicMock()
        error = ClientError(
            {
                "Error": {
                    "Code": "InvalidArgument",
                    "Message": "Invalid version id specified",
                }
            },
            "GetObject",
        )
        client.get_object.side_effect = error

        with pytest.raises(S3FileError) as exc_info:
            S3Service(bucket="bucket", client=client).get_object_or_raise(
                "path/file.pdf"
            )

        assert exc_info.value.__cause__ is error


class TestGetHeadOrRaise:
    def test_omits_empty_version_id(self) -> None:
        client = MagicMock()
        client.head_object.return_value = {"ETag": "etag"}

        result = S3Service(bucket="bucket", client=client).get_head_or_raise(
            "path/file.pdf"
        )

        assert result == {"ETag": "etag"}
        client.head_object.assert_called_once_with(Bucket="bucket", Key="path/file.pdf")

    def test_passes_version_id(self) -> None:
        client = MagicMock()
        client.head_object.return_value = {"ETag": "etag"}

        S3Service(bucket="bucket", client=client).get_head_or_raise(
            "path/file.pdf", s3_version_id="v1"
        )

        client.head_object.assert_called_once_with(
            Bucket="bucket", Key="path/file.pdf", VersionId="v1"
        )

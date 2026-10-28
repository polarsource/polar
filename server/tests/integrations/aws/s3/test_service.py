from unittest.mock import MagicMock

import pytest
from botocore.client import ClientError
from botocore.exceptions import ParamValidationError

from polar.integrations.aws.s3.exceptions import (
    S3CompleteMultipartUploadError,
    S3FileError,
    S3MultipartUploadInvalidPart,
    S3MultipartUploadInvalidRequest,
    S3MultipartUploadMissingPartChecksum,
    S3MultipartUploadNotFound,
)
from polar.integrations.aws.s3.schemas import (
    S3FileUploadCompleted,
    S3FileUploadCompletedPart,
)
from polar.integrations.aws.s3.service import S3Service


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


class TestCompleteMultipartUpload:
    completed = S3FileUploadCompleted(
        id="upload-id",
        path="path/file.pdf",
        parts=[
            S3FileUploadCompletedPart(
                number=1, checksum_etag="etag", checksum_sha256_base64=None
            )
        ],
    )

    @pytest.mark.parametrize(
        ("code", "message", "expected"),
        [
            (
                "NoSuchUpload",
                "The specified upload does not exist.",
                S3MultipartUploadNotFound,
            ),
            (
                "InvalidPart",
                "One or more of the specified parts could not be found.",
                S3MultipartUploadInvalidPart,
            ),
            (
                "InvalidPartOrder",
                "The list of parts was not in ascending order.",
                S3MultipartUploadInvalidPart,
            ),
            (
                "InvalidRequest",
                "The upload was created using a sha256 checksum. The complete request must include the checksum for each part. It was missing for part 1 in the request.",
                S3MultipartUploadMissingPartChecksum,
            ),
            (
                "MalformedXML",
                "The XML you provided was not well-formed.",
                S3MultipartUploadInvalidRequest,
            ),
        ],
    )
    def test_client_errors(
        self,
        code: str,
        message: str,
        expected: type[S3CompleteMultipartUploadError],
    ) -> None:
        client = MagicMock()
        error = ClientError(
            {"Error": {"Code": code, "Message": message}}, "CompleteMultipartUpload"
        )
        client.complete_multipart_upload.side_effect = error

        with pytest.raises(expected) as exc_info:
            S3Service(bucket="bucket", client=client).complete_multipart_upload(
                self.completed
            )

        assert exc_info.value.message == message
        assert exc_info.value.__cause__ is error

    def test_param_validation_error(self) -> None:
        client = MagicMock()
        client.complete_multipart_upload.side_effect = ParamValidationError(
            report="Invalid length for parameter UploadId"
        )

        with pytest.raises(S3MultipartUploadInvalidRequest):
            S3Service(bucket="bucket", client=client).complete_multipart_upload(
                self.completed
            )

    def test_unexpected_client_error(self) -> None:
        client = MagicMock()
        error = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "CompleteMultipartUpload",
        )
        client.complete_multipart_upload.side_effect = error

        with pytest.raises(ClientError) as exc_info:
            S3Service(bucket="bucket", client=client).complete_multipart_upload(
                self.completed
            )

        assert exc_info.value is error

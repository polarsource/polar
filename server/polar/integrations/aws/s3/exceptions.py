from polar.exceptions import PolarError


class S3FileError(PolarError): ...


class S3UnsupportedFile(S3FileError): ...

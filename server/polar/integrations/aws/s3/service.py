from .client import client


class S3Service:
    client = client

    @classmethod
    def downloadable_disposition(cls, filename: str) -> str:
        return f'attachment; filename="{filename}"'

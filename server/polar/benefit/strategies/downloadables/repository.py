from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import case, func

from polar.kit.pagination import PaginationParams, paginate
from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import Downloadable, File
from polar.models.file import FileServiceTypes

type BenefitFileResult = tuple[File, int, int]


class BenefitDownloadableFileRepository(
    RepositorySoftDeletionMixin[File], RepositoryBase[File]
):
    model = File

    async def paginate_files(
        self,
        benefit_id: UUID,
        file_ids: Sequence[UUID],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[BenefitFileResult], int]:
        if not file_ids:
            return [], 0

        file_order = case(
            {file_id: index for index, file_id in enumerate(file_ids)},
            value=File.id,
        )
        statement = (
            self.get_base_statement()
            .with_only_columns(
                File,
                func.count(
                    func.distinct(
                        func.coalesce(Downloadable.member_id, Downloadable.customer_id)
                    )
                )
                .filter(Downloadable.downloaded > 0)
                .label("downloaders"),
                func.coalesce(func.sum(Downloadable.downloaded), 0).label("downloads"),
            )
            .outerjoin(
                Downloadable,
                (Downloadable.file_id == File.id)
                & (Downloadable.benefit_id == benefit_id)
                & (Downloadable.is_deleted.is_(False)),
            )
            .where(
                File.id.in_(file_ids),
                File.is_uploaded.is_(True),
                File.service == FileServiceTypes.downloadable,
            )
            .group_by(File.id)
            .order_by(file_order)
        )
        results, count = await paginate(self.session, statement, pagination=pagination)
        return results, count

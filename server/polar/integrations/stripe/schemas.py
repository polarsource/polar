from polar.kit.schemas import Schema


class CreateIntent(Schema):
    issue_id: str
    amount: int

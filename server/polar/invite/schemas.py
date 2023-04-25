from polar.kit.schemas import Schema


class InviteRead(Schema):
    code: str
    sent_to_email: str | None = None

    class Config:
        orm_mode = True

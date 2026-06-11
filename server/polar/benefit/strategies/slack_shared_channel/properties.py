from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitSlackSharedChannelProperties(BenefitProperties):
    slack_integration_id: str
    channel_name_template: str
    private: bool
    welcome_message: str | None
    archive_on_revoke: bool
    team_invitees: list[str]


class BenefitGrantSlackSharedChannelProperties(BenefitGrantProperties, total=False):
    invited_email: str
    channel_id: str
    channel_name: str
    invite_id: str
    invite_url: str
    connected_team_id: str

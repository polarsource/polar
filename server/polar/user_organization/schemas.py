from polar.kit.schemas import Schema


class UserOrganizationSettingsUpdate(Schema):
    email_notification_maintainer_issue_receives_backing: bool | None = None
    email_notification_maintainer_issue_branch_created: bool | None = None
    email_notification_maintainer_pull_request_created: bool | None = None
    email_notification_maintainer_pull_request_merged: bool | None = None
    email_notification_backed_issue_branch_created: bool | None = None
    email_notification_backed_issue_pull_request_created: bool | None = None
    email_notification_backed_issue_pull_request_merged: bool | None = None


class UserOrganizationSettingsRead(Schema):
    email_notification_maintainer_issue_receives_backing: bool = True
    email_notification_maintainer_issue_branch_created: bool = False
    email_notification_maintainer_pull_request_created: bool = False
    email_notification_maintainer_pull_request_merged: bool = False
    email_notification_backed_issue_branch_created: bool = True
    email_notification_backed_issue_pull_request_created: bool = True
    email_notification_backed_issue_pull_request_merged: bool = True

    class Config:
        orm_mode = True

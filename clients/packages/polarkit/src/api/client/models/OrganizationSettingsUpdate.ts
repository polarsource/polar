/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type OrganizationSettingsUpdate = {
  pledge_badge_retroactive?: boolean;
  pledge_badge_show_amount?: boolean;
  email_notification_maintainer_issue_receives_backing?: boolean;
  email_notification_maintainer_issue_branch_created?: boolean;
  email_notification_maintainer_pull_request_created?: boolean;
  email_notification_maintainer_pull_request_merged?: boolean;
  email_notification_backed_issue_branch_created?: boolean;
  email_notification_backed_issue_pull_request_created?: boolean;
  email_notification_backed_issue_pull_request_merged?: boolean;
};


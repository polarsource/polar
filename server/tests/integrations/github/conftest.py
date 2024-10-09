import datetime

from polar.integrations.github import types


def create_github_organization(
    id: int,
    name: str,
) -> types.OrganizationFull:
    return types.OrganizationFull(
        id=id,
        name=name,
        login=name,
        node_id=f"org_dummy_{id}",
        url="xx",
        repos_url="xx",
        events_url="xx",
        hooks_url="xx",
        issues_url="xx",
        members_url="xx",
        public_members_url="xx",
        avatar_url="xx",
        description="xx",
        company="xx",
        blog="xx",
        location="xx",
        email="xx",
        twitter_username="xx",
        is_verified=False,
        has_organization_projects=False,
        has_repository_projects=False,
        public_repos=3,
        public_gists=0,
        followers=0,
        following=8,
        html_url="xx",
        type="xx",
        total_private_repos=0,
        owned_private_repos=0,
        private_gists=0,
        disk_usage=0,
        collaborators=0,
        billing_email="xx",
        plan=None,
        default_repository_permission="xx",
        members_can_create_repositories=None,
        two_factor_requirement_enabled=None,
        members_allowed_repository_creation_type="xx",
        members_can_create_public_repositories=None,
        members_can_create_private_repositories=None,
        members_can_create_internal_repositories=None,
        members_can_create_pages=None,
        members_can_create_public_pages=None,
        members_can_create_private_pages=None,
        members_can_fork_private_repositories=None,
        advanced_security_enabled_for_new_repositories=False,
        dependabot_alerts_enabled_for_new_repositories=False,
        dependabot_security_updates_enabled_for_new_repositories=False,
        dependency_graph_enabled_for_new_repositories=False,
        secret_scanning_enabled_for_new_repositories=False,
        secret_scanning_push_protection_enabled_for_new_repositories=False,
        secret_scanning_push_protection_custom_link_enabled=False,
        secret_scanning_push_protection_custom_link=None,
        web_commit_signoff_required=False,
        created_at=datetime.datetime(2024, 3, 13),
        updated_at=datetime.datetime(2024, 3, 13),
        archived_at=None,
    )


def create_github_repository(
    id: int,
    name: str,
    private: bool,
) -> types.Repository:
    return types.Repository(
        id=id,
        node_id=f"dummy_{id}",
        name=name,
        full_name=f"org/{name}",
        private=private,
        # dummy values
        license_=None,
        forks=0,
        permissions=types.RepositoryPropPermissions(
            admin=True,
            pull=True,
            push=True,
            maintain=True,
            triage=True,
        ),
        owner=create_github_user(),
        html_url="xx",
        description=None,
        fork=False,
        url="xx",
        archive_url="xx",
        assignees_url="xx",
        blobs_url="xx",
        branches_url="xx",
        collaborators_url="xx",
        comments_url="xx",
        commits_url="xx",
        compare_url="xx",
        contents_url="xx",
        contributors_url="xx",
        deployments_url="xx",
        downloads_url="xx",
        events_url="xx",
        forks_url="xx",
        git_commits_url="xx",
        git_refs_url="xx",
        git_tags_url="xx",
        git_url="xx",
        issue_comment_url="xx",
        issue_events_url="xx",
        issues_url="xx",
        keys_url="xx",
        labels_url="xx",
        languages_url="xx",
        merges_url="xx",
        milestones_url="xx",
        notifications_url="xx",
        pulls_url="xx",
        releases_url="xx",
        ssh_url="xx",
        stargazers_url="xx",
        statuses_url="xx",
        subscribers_url="xx",
        subscription_url="xx",
        tags_url="xx",
        teams_url="xx",
        trees_url="xx",
        clone_url="xx",
        mirror_url=None,
        hooks_url="xx",
        svn_url="xx",
        homepage=None,
        language=None,
        forks_count=0,
        stargazers_count=0,
        watchers_count=0,
        size=0,
        default_branch="main",
        open_issues_count=20,
        is_template=False,
        topics=[],
        has_issues=True,
        has_projects=True,
        has_wiki=True,
        has_pages=True,
        has_downloads=True,
        has_discussions=True,
        archived=False,
        disabled=False,
        visibility="private",
        pushed_at=None,
        created_at=None,
        updated_at=None,
        allow_rebase_merge=True,
        temp_clone_token=None,
        allow_squash_merge=True,
        allow_auto_merge=True,
        delete_branch_on_merge=True,
        allow_update_branch=True,
        use_squash_pr_title_as_default=True,
        squash_merge_commit_title="PR_TITLE",
        squash_merge_commit_message="PR_BODY",
        merge_commit_title="PR_TITLE",
        merge_commit_message="PR_BODY",
        allow_merge_commit=True,
        allow_forking=True,
        web_commit_signoff_required=True,
        open_issues=123,
        watchers=123,
        master_branch="main",
        starred_at="",
        anonymous_access_enabled=True,
    )


def create_github_installation(org_name: str, org_id: int) -> types.Installation:
    return types.Installation(
        id=30511112,
        account=types.SimpleUser(
            login=org_name,
            id=org_id,
            node_id="O_kgDOBkfenA",
            avatar_url="https://avatars.githubusercontent.com/u/105373340?v=4",
            gravatar_id="",
            url="https://api.github.com/users/HubbenCo",
            html_url="https://github.com/HubbenCo",
            followers_url="https://api.github.com/users/HubbenCo/followers",
            following_url="https://api.github.com/users/HubbenCo/following{/other_user}",
            gists_url="https://api.github.com/users/HubbenCo/gists{/gist_id}",
            starred_url="https://api.github.com/users/HubbenCo/starred{/owner}{/repo}",
            subscriptions_url="https://api.github.com/users/HubbenCo/subscriptions",
            organizations_url="https://api.github.com/users/HubbenCo/orgs",
            repos_url="https://api.github.com/users/HubbenCo/repos",
            events_url="https://api.github.com/users/HubbenCo/events{/privacy}",
            received_events_url="https://api.github.com/users/HubbenCo/received_events",
            type="Organization",
            site_admin=False,
        ),
        repository_selection="selected",
        access_tokens_url="https://api.github.com/app/installations/30511112/access_tokens",
        repositories_url="https://api.github.com/installation/repositories",
        html_url="https://github.com/organizations/HubbenCo/settings/installations/30511112",
        app_id=238394,
        app_slug="hubbenco",
        target_id=105373340,
        target_type="Organization",
        permissions=types.AppPermissions(
            issues="write",
            members="read",
            metadata="read",
            pull_requests="write",
            administration="read",
            repository_hooks="read",
            team_discussions="write",
        ),
        events=[
            "discussion",
            "discussion_comment",
            "issues",
            "issue_comment",
            "label",
            "member",
            "milestone",
            "organization",
            "public",
            "repository",
            "team",
            "team_add",
        ],
        created_at=datetime.datetime(2024, 3, 13),
        updated_at=datetime.datetime(2024, 3, 13),
        single_file_name=None,
        has_multiple_single_files=False,
        single_file_paths=[],
        suspended_by=None,
        suspended_at=None,
    )


def create_github_user() -> types.SimpleUser:
    return types.SimpleUser(
        login="birkjernstrom",
        id=281715,
        node_id="MDQ6VXNlcjI4MTcxNQ==",
        avatar_url="https://avatars.githubusercontent.com/u/281715?v=4",
        gravatar_id="",
        url="https://api.github.com/users/birkjernstrom",
        html_url="https://github.com/birkjernstrom",
        followers_url="https://api.github.com/users/birkjernstrom/followers",
        following_url="https://api.github.com/users/birkjernstrom/following{/other_user}",
        gists_url="https://api.github.com/users/birkjernstrom/gists{/gist_id}",
        starred_url="https://api.github.com/users/birkjernstrom/starred{/owner}{/repo}",
        subscriptions_url="https://api.github.com/users/birkjernstrom/subscriptions",
        organizations_url="https://api.github.com/users/birkjernstrom/orgs",
        repos_url="https://api.github.com/users/birkjernstrom/repos",
        events_url="https://api.github.com/users/birkjernstrom/events{/privacy}",
        received_events_url="https://api.github.com/users/birkjernstrom/received_events",
        type="User",
        site_admin=False,
    )


def create_github_user_webhooks() -> types.SimpleUserWebhooks:
    return types.SimpleUserWebhooks(
        login="birkjernstrom",
        id=281715,
        node_id="MDQ6VXNlcjI4MTcxNQ==",
        avatar_url="https://avatars.githubusercontent.com/u/281715?v=4",
        gravatar_id="",
        url="https://api.github.com/users/birkjernstrom",
        html_url="https://github.com/birkjernstrom",
        followers_url="https://api.github.com/users/birkjernstrom/followers",
        following_url="https://api.github.com/users/birkjernstrom/following{/other_user}",
        gists_url="https://api.github.com/users/birkjernstrom/gists{/gist_id}",
        starred_url="https://api.github.com/users/birkjernstrom/starred{/owner}{/repo}",
        subscriptions_url="https://api.github.com/users/birkjernstrom/subscriptions",
        organizations_url="https://api.github.com/users/birkjernstrom/orgs",
        repos_url="https://api.github.com/users/birkjernstrom/repos",
        events_url="https://api.github.com/users/birkjernstrom/events{/privacy}",
        received_events_url="https://api.github.com/users/birkjernstrom/received_events",
        type="User",
        site_admin=False,
    )

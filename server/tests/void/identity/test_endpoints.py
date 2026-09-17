import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.kit.utils import utc_now
from polar.models import Organization, VoidBillingIdentity
from tests.fixtures.database import SaveFixture
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/identities"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.asyncio
class TestEnsure:
    async def test_create_and_sticky_repeat(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        created = await void_client.post(
            PATH, headers=HEADERS, json={"external_id": "root", "metadata": {"key": 1}}
        )
        assert created.status_code == 201
        data = created.json()
        assert set(data) == {
            "id",
            "external_id",
            "parent_external_id",
            "metadata",
            "created_at",
        }
        assert data["parent_external_id"] is None
        repeated = await void_client.post(
            PATH,
            headers=HEADERS,
            json={
                "external_id": "root",
                "parent_external_id": "missing",
                "metadata": {"key": 2},
            },
        )
        assert repeated.status_code == 200
        assert repeated.json() == data

    async def test_child_preserves_parent_and_metadata(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        await save_fixture(
            VoidBillingIdentity(organization=organization, external_id="root")
        )
        created = await void_client.post(
            PATH,
            headers=HEADERS,
            json={
                "external_id": "child",
                "parent_external_id": "root",
                "metadata": {"nested": [1, None]},
            },
        )
        assert created.status_code == 201
        assert created.json()["parent_external_id"] == "root"
        assert created.json()["metadata"] == {"nested": [1, None]}
        repeated = await void_client.post(
            PATH, headers=HEADERS, json={"external_id": "child"}
        )
        assert repeated.status_code == 200
        assert repeated.json() == created.json()

    @pytest.mark.parametrize(
        "parent_state", ["missing", "deleted", "other_organization"]
    )
    async def test_unavailable_parent(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
        parent_state: str,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        if parent_state != "missing":
            await save_fixture(
                VoidBillingIdentity(
                    organization=organization_second
                    if parent_state == "other_organization"
                    else organization,
                    external_id="parent",
                    deleted_at=utc_now() if parent_state == "deleted" else None,
                )
            )
        response = await void_client.post(
            PATH,
            headers=HEADERS,
            json={"external_id": "child", "parent_external_id": "parent"},
        )
        assert response.status_code == 404
        result = await void_client.get(PATH, headers=HEADERS)
        assert result.json() == []

    async def test_deleted_external_id_is_reserved(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        await save_fixture(
            VoidBillingIdentity(
                organization=organization, external_id="gone", deleted_at=utc_now()
            )
        )
        response = await void_client.post(
            PATH, headers=HEADERS, json={"external_id": "gone"}
        )
        assert response.status_code == 409
        assert response.json()["error"] == "DeletedIdentityConflict"

    @pytest.mark.parametrize(
        "body",
        [
            {"external_id": ""},
            {"external_id": "a" * 256},
            {"external_id": "a", "parent_external_id": ""},
            {"external_id": "nul\x00"},
            {"external_id": "a", "metadata": {"value": "nul\x00"}},
        ],
    )
    async def test_invalid_payload(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        body: dict[str, object],
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        response = await void_client.post(PATH, headers=HEADERS, json=body)
        assert response.status_code == 422

    async def test_read_scope_cannot_create(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization)
        response = await void_client.post(
            PATH, headers=HEADERS, json={"external_id": "root"}
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestListAndGet:
    async def test_tree_and_filters(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        await create_token(save_fixture, organization)
        root = VoidBillingIdentity(organization=organization, external_id="root")
        await save_fixture(root)
        child = VoidBillingIdentity(
            organization=organization, external_id="child", parent=root
        )
        await save_fixture(child)
        await save_fixture(
            VoidBillingIdentity(
                organization=organization, external_id="leaf", parent=child
            )
        )
        await save_fixture(
            VoidBillingIdentity(
                organization=organization, external_id="deleted", deleted_at=utc_now()
            )
        )
        await save_fixture(
            VoidBillingIdentity(organization=organization_second, external_id="foreign")
        )
        listed = await void_client.get(PATH, headers=HEADERS)
        assert listed.status_code == 200
        assert {item["external_id"] for item in listed.json()} == {
            "root",
            "child",
            "leaf",
        }
        roots = await void_client.get(PATH, headers=HEADERS, params={"root": "true"})
        assert [item["external_id"] for item in roots.json()] == ["root"]
        children = await void_client.get(
            PATH, headers=HEADERS, params={"parent": "root", "root": "true"}
        )
        assert [item["external_id"] for item in children.json()] == ["child"]
        detail = await void_client.get(f"{PATH}/child", headers=HEADERS)
        assert detail.status_code == 200
        assert detail.json()["chain"] == ["child", "root"]
        assert detail.json()["parent_external_id"] == "root"
        assert [item["external_id"] for item in detail.json()["children"]] == ["leaf"]
        leaf = await void_client.get(f"{PATH}/leaf", headers=HEADERS)
        assert leaf.json()["chain"] == ["leaf", "child", "root"]
        assert leaf.json()["children"] == []
        for unavailable in ["deleted", "foreign", "missing"]:
            response = await void_client.get(f"{PATH}/{unavailable}", headers=HEADERS)
            assert response.status_code == 404
        missing_parent = await void_client.get(
            PATH, headers=HEADERS, params={"parent": "foreign"}
        )
        assert missing_parent.status_code == 404

    async def test_slashed_external_id(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization)
        root = VoidBillingIdentity(
            organization=organization, external_id="orbital-foods"
        )
        await save_fixture(root)
        await save_fixture(
            VoidBillingIdentity(
                organization=organization,
                external_id="orbital-foods/deploy-bot",
                parent=root,
            )
        )
        detail = await void_client.get(
            f"{PATH}/orbital-foods/deploy-bot", headers=HEADERS
        )
        assert detail.status_code == 200
        assert detail.json()["external_id"] == "orbital-foods/deploy-bot"
        assert detail.json()["chain"] == ["orbital-foods/deploy-bot", "orbital-foods"]
        snapshot = await void_client.get(
            f"{PATH}/orbital-foods/deploy-bot/snapshot", headers=HEADERS
        )
        if snapshot.status_code == 200:
            assert "meters" in snapshot.json()
        assert "deploy-bot/snapshot" not in snapshot.text

    @pytest.mark.parametrize("path", [PATH, f"{PATH}/root"])
    async def test_anonymous(self, void_client: AsyncClient, path: str) -> None:
        response = await void_client.get(path)
        assert response.status_code == 401

    async def test_gate(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_write})
        organization.feature_settings = {
            **organization.feature_settings,
            "void_enabled": False,
        }
        await save_fixture(organization)
        assert (await void_client.get(PATH, headers=HEADERS)).status_code == 404
        assert (
            await void_client.post(PATH, headers=HEADERS, json={"external_id": "root"})
        ).status_code == 404

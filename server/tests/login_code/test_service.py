import pytest
from pytest_mock import MockerFixture

from polar.login_code.service import LoginCodeInvalidOrExpired
from polar.login_code.service import login_code as login_code_service
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_user

APP_REVIEW_TEST_EMAIL = "review@test.com"
APP_REVIEW_TEST_CODE_VALID = "TEST01"
APP_REVIEW_TEST_CODE_INVALID = "INVALID"


@pytest.mark.asyncio
class TestAuthenticate:
    async def test_invalid_code(
        self,
        session: AsyncSession,
    ) -> None:
        """Test that authentication fails with an invalid code."""
        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(
                session,
                code=APP_REVIEW_TEST_CODE_INVALID,
                email=APP_REVIEW_TEST_EMAIL,
            )

    async def test_app_review_bypass_disabled_by_default(
        self,
        session: AsyncSession,
    ) -> None:
        """Test that app review bypass doesn't work when not configured."""
        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(
                session,
                code=APP_REVIEW_TEST_CODE_VALID,
                email=APP_REVIEW_TEST_EMAIL,
            )

    async def test_app_review_bypass_works_when_configured(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        """Test that app review bypass works when properly configured."""
        existing_user = await create_user(save_fixture)
        existing_user.email = APP_REVIEW_TEST_EMAIL
        existing_user.email_verified = True
        await save_fixture(existing_user)

        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_EMAIL",
            APP_REVIEW_TEST_EMAIL,
        )
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_OTP_CODE",
            APP_REVIEW_TEST_CODE_VALID,
        )

        user, is_signup = await login_code_service.authenticate(
            session,
            code=APP_REVIEW_TEST_CODE_VALID,
            email=APP_REVIEW_TEST_EMAIL,
        )

        assert user is not None
        assert user.id == existing_user.id
        assert user.email == APP_REVIEW_TEST_EMAIL

    async def test_app_review_bypass_wrong_code(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        """Test that app review bypass fails with wrong code."""
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_EMAIL",
            APP_REVIEW_TEST_EMAIL,
        )
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_OTP_CODE",
            APP_REVIEW_TEST_CODE_VALID,
        )

        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(
                session,
                code="WRONG1",
                email=APP_REVIEW_TEST_EMAIL,
            )

    async def test_app_review_bypass_wrong_email(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        """Test that app review bypass fails with wrong email."""
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_EMAIL",
            APP_REVIEW_TEST_EMAIL,
        )
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_OTP_CODE",
            APP_REVIEW_TEST_CODE_VALID,
        )

        with pytest.raises(LoginCodeInvalidOrExpired):
            await login_code_service.authenticate(
                session,
                code=APP_REVIEW_TEST_CODE_VALID,
                email="wrong@example.com",
            )

    async def test_app_review_bypass_reuses_existing_user(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
    ) -> None:
        """Test that app review bypass returns existing user if already exists."""
        existing_user = await create_user(save_fixture)
        existing_user.email = APP_REVIEW_TEST_EMAIL
        existing_user.email_verified = True
        await save_fixture(existing_user)

        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_EMAIL",
            APP_REVIEW_TEST_EMAIL,
        )
        mocker.patch(
            "polar.login_code.service.settings.APP_REVIEW_OTP_CODE",
            APP_REVIEW_TEST_CODE_VALID,
        )

        user, is_signup = await login_code_service.authenticate(
            session,
            code=APP_REVIEW_TEST_CODE_VALID,
            email=APP_REVIEW_TEST_EMAIL,
        )

        assert user is not None
        assert user.id == existing_user.id
        assert is_signup is False

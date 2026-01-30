from datetime import datetime
from uuid import uuid4

from polar.customer_seat.schemas import CustomerSeat as CustomerSeatSchema
from polar.models.customer_seat import SeatStatus
from polar.models.member import MemberRole


class TestCustomerSeatSchema:
    """Unit tests for CustomerSeat schema serialization."""

    def test_serialize_with_member_from_dict(self) -> None:
        """Schema correctly serializes member from dict data."""
        member_id = uuid4()
        customer_id = uuid4()

        data = {
            "id": uuid4(),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "subscription_id": uuid4(),
            "order_id": None,
            "status": SeatStatus.claimed,
            "customer_id": customer_id,
            "member_id": member_id,
            "member": {
                "id": member_id,
                "created_at": datetime.now(),
                "modified_at": datetime.now(),
                "customer_id": customer_id,
                "email": "member@example.com",
                "name": "Test Member",
                "external_id": "ext_123",
                "role": MemberRole.member,
            },
            "email": "member@example.com",
            "invitation_token_expires_at": None,
            "claimed_at": datetime.now(),
            "revoked_at": None,
            "seat_metadata": None,
        }

        schema = CustomerSeatSchema.model_validate(data)

        assert schema.member is not None
        assert schema.member.id == member_id
        assert schema.member.email == "member@example.com"
        assert schema.member.name == "Test Member"
        assert schema.member.external_id == "ext_123"
        assert schema.member.role == MemberRole.member
        assert schema.member.customer_id == customer_id

    def test_serialize_without_member_from_dict(self) -> None:
        """Schema correctly handles None member from dict data."""
        data = {
            "id": uuid4(),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "subscription_id": uuid4(),
            "order_id": None,
            "status": SeatStatus.pending,
            "customer_id": uuid4(),
            "member_id": None,
            "member": None,
            "email": None,
            "invitation_token_expires_at": None,
            "claimed_at": None,
            "revoked_at": None,
            "seat_metadata": None,
        }

        schema = CustomerSeatSchema.model_validate(data)

        assert schema.member is None
        assert schema.member_id is None

    def test_customer_email_priority_with_member(self) -> None:
        """customer_email uses seat.email first, then member.email."""
        member_id = uuid4()

        # When seat.email is set, it takes priority
        data = {
            "id": uuid4(),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "subscription_id": uuid4(),
            "order_id": None,
            "status": SeatStatus.claimed,
            "customer_id": uuid4(),
            "member_id": member_id,
            "member": {
                "id": member_id,
                "created_at": datetime.now(),
                "modified_at": datetime.now(),
                "customer_id": uuid4(),
                "email": "member@example.com",
                "name": "Member",
                "external_id": None,
                "role": MemberRole.member,
            },
            "email": "seat-email@example.com",
            "invitation_token_expires_at": None,
            "claimed_at": None,
            "revoked_at": None,
            "seat_metadata": None,
        }

        schema = CustomerSeatSchema.model_validate(data)
        assert schema.customer_email == "seat-email@example.com"

    def test_customer_email_falls_back_to_member_email(self) -> None:
        """customer_email falls back to member.email when seat.email is None."""
        member_id = uuid4()

        data = {
            "id": uuid4(),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "subscription_id": uuid4(),
            "order_id": None,
            "status": SeatStatus.claimed,
            "customer_id": uuid4(),
            "member_id": member_id,
            "member": {
                "id": member_id,
                "created_at": datetime.now(),
                "modified_at": datetime.now(),
                "customer_id": uuid4(),
                "email": "member@example.com",
                "name": "Member",
                "external_id": None,
                "role": MemberRole.member,
            },
            "email": None,
            "invitation_token_expires_at": None,
            "claimed_at": None,
            "revoked_at": None,
            "seat_metadata": None,
        }

        schema = CustomerSeatSchema.model_validate(data)
        assert schema.customer_email == "member@example.com"

    def test_member_fields_in_serialized_output(self) -> None:
        """Serialized output includes all expected member fields."""
        member_id = uuid4()
        customer_id = uuid4()

        data = {
            "id": uuid4(),
            "created_at": datetime.now(),
            "modified_at": datetime.now(),
            "subscription_id": uuid4(),
            "order_id": None,
            "status": SeatStatus.claimed,
            "customer_id": customer_id,
            "member_id": member_id,
            "member": {
                "id": member_id,
                "created_at": datetime.now(),
                "modified_at": datetime.now(),
                "customer_id": customer_id,
                "email": "member@example.com",
                "name": "Test Member",
                "external_id": "ext_456",
                "role": MemberRole.owner,
            },
            "email": "member@example.com",
            "invitation_token_expires_at": None,
            "claimed_at": None,
            "revoked_at": None,
            "seat_metadata": None,
        }

        schema = CustomerSeatSchema.model_validate(data)
        output = schema.model_dump()

        member_output = output["member"]
        assert "id" in member_output
        assert "email" in member_output
        assert "name" in member_output
        assert "role" in member_output
        assert "external_id" in member_output
        assert "customer_id" in member_output

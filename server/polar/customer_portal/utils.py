from typing import Any
from uuid import UUID

from polar.auth.models import AuthSubject, Customer, Member, is_customer, is_member
from polar.exceptions import NotPermitted
from polar.models import Customer as CustomerModel


def get_audit_context(auth_subject: AuthSubject[Customer | Member]) -> dict[str, Any]:
    """
    Get audit context information from the auth subject for logging.

    Returns a dict with:
    - customer_id: Always present
    - actor_type: Either "customer" or "member"
    - member_id: Present if actor is a member
    - member_role: Present if actor is a member (owner, billing_manager, member)
    """
    if is_customer(auth_subject):
        return {
            "customer_id": auth_subject.subject.id,
            "actor_type": "customer",
        }
    if is_member(auth_subject):
        return {
            "customer_id": auth_subject.subject.customer_id,
            "actor_type": "member",
            "member_id": auth_subject.subject.id,
            "member_role": auth_subject.subject.role,
        }
    raise NotPermitted("Invalid auth subject type")


def get_customer_id(auth_subject: AuthSubject[Customer | Member]) -> UUID:
    """
    Extract customer_id from Customer or Member auth subject.

    For Customer subjects, returns the customer's ID directly.
    For Member subjects, returns the member's associated customer_id.

    Raises NotPermitted if the auth subject is neither Customer nor Member.
    """
    if is_customer(auth_subject):
        return auth_subject.subject.id
    if is_member(auth_subject):
        return auth_subject.subject.customer_id
    raise NotPermitted("Invalid auth subject type")


def get_customer(auth_subject: AuthSubject[Customer | Member]) -> CustomerModel:
    """
    Get the Customer from Customer or Member auth subject.

    For Customer subjects, returns the customer directly.
    For Member subjects, returns the member's associated customer.

    Raises NotPermitted if the auth subject is neither Customer nor Member.
    """
    if is_customer(auth_subject):
        return auth_subject.subject
    if is_member(auth_subject):
        return auth_subject.subject.customer
    raise NotPermitted("Invalid auth subject type")

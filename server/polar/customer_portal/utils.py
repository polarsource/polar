from uuid import UUID

from polar.auth.models import AuthSubject, Customer, Member, is_customer, is_member
from polar.exceptions import NotPermitted
from polar.models import Customer as CustomerModel


def get_customer_id(auth_subject: AuthSubject[Customer | Member]) -> UUID:
    """
    Extract customer_id from Customer or Member auth subject.

    For Customer subjects, returns the customer's ID directly.
    For Member subjects, returns the member's associated customer_id.

    Raises NotPermitted if the auth subject is neither Customer nor Member.
    """
    if is_customer(auth_subject):
        return auth_subject.subject.id
    elif is_member(auth_subject):
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
    elif is_member(auth_subject):
        return auth_subject.subject.customer
    raise NotPermitted("Invalid auth subject type")

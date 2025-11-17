"""Enums for Agent Core - Intent classification and Action selection."""

from enum import StrEnum


class Intent(StrEnum):
    """Customer intent detected from conversation."""

    # Product discovery
    PRODUCT_QUERY = "product_query"
    """Customer searching for products (e.g., "looking for blue dress")"""

    BROWSING = "browsing"
    """General browsing, no specific intent"""

    PRODUCT_COMPARISON = "product_comparison"
    """Comparing multiple products"""

    # Purchase intent
    PURCHASE_INTENT = "purchase_intent"
    """Customer ready to buy (e.g., "I'll take it")"""

    CHECKOUT_READY = "checkout_ready"
    """Explicit checkout request (e.g., "proceed to checkout")"""

    # Pricing & negotiation
    PRICE_QUERY = "price_query"
    """Asking about price"""

    PRICE_NEGOTIATION = "price_negotiation"
    """Attempting to negotiate price (e.g., "Can you do $80?")"""

    DISCOUNT_INQUIRY = "discount_inquiry"
    """Asking about discounts/coupons"""

    # Support & information
    SHIPPING_QUESTION = "shipping_question"
    """Questions about shipping (cost, time, tracking)"""

    RETURN_QUESTION = "return_question"
    """Questions about returns/refunds"""

    SUPPORT_REQUEST = "support_request"
    """General support question"""

    FAQ = "faq"
    """Frequently asked question"""

    POLICY_QUESTION = "policy_question"
    """Questions about policies (privacy, terms, etc.)"""

    # Payment & orders
    PAYMENT_ISSUE = "payment_issue"
    """Payment problem or question"""

    PAYMENT_CONFIRMATION = "payment_confirmation"
    """Confirming payment intent"""

    ORDER_STATUS = "order_status"
    """Checking order status"""

    REFUND_REQUEST = "refund_request"
    """Requesting refund"""

    # Conversation management
    GREETING = "greeting"
    """Customer greeting (e.g., "hi", "hello")"""

    UNCERTAINTY = "uncertainty"
    """Customer uncertain/hesitating"""

    ESCALATION = "escalation"
    """Customer wants human agent"""

    FAREWELL = "farewell"
    """Customer ending conversation"""

    # Special
    UNKNOWN = "unknown"
    """Intent unclear"""


class Action(StrEnum):
    """Agent actions to take based on intent."""

    # Product actions
    SEARCH_PRODUCTS = "search_products"
    """Search product catalog with RAG"""

    SHOW_PRODUCT_DETAILS = "show_product_details"
    """Display detailed product information"""

    COMPARE_PRODUCTS = "compare_products"
    """Compare multiple products side-by-side"""

    ASK_VARIANT = "ask_variant"
    """Ask customer to select variant (size, color, etc.)"""

    CHECK_INVENTORY = "check_inventory"
    """Check product availability"""

    # Pricing actions
    CALCULATE_OFFER = "calculate_offer"
    """Calculate dynamic price offer"""

    APPLY_DISCOUNT = "apply_discount"
    """Apply discount code"""

    EXPLAIN_NO_DISCOUNT = "explain_no_discount"
    """Explain why discount not available"""

    # Checkout actions
    GENERATE_CHECKOUT = "generate_checkout"
    """Create checkout session"""

    UPDATE_CART = "update_cart"
    """Modify cart items"""

    CALCULATE_SHIPPING = "calculate_shipping"
    """Calculate shipping cost"""

    CALCULATE_TAX = "calculate_tax"
    """Calculate tax"""

    # Support actions
    SEARCH_FAQ = "search_faq"
    """Search FAQ/knowledge base"""

    LOOKUP_POLICY = "lookup_policy"
    """Retrieve policy information"""

    CHECK_ORDER_STATUS = "check_order_status"
    """Look up order status"""

    INITIATE_REFUND = "initiate_refund"
    """Start refund process"""

    # Response actions
    GREET = "greet"
    """Send greeting message"""

    CLARIFY = "clarify"
    """Ask clarifying question"""

    ACKNOWLEDGE = "acknowledge"
    """Acknowledge customer message"""

    FAREWELL = "farewell"
    """Send goodbye message"""

    ESCALATE = "escalate"
    """Transfer to human agent"""

    # Special
    NO_ACTION = "no_action"
    """No action needed (e.g., just acknowledging)"""


class AgentType(StrEnum):
    """Type of specialist agent."""

    SALES = "sales"
    """Sales agent - product discovery and conversion"""

    SUPPORT = "support"
    """Support agent - FAQs and troubleshooting"""

    PAYMENT = "payment"
    """Payment agent - checkout and order issues"""

    GENERAL = "general"
    """General agent - handles all intents"""

# Trust & Transparency Layer Skill

## Purpose
Build explainability, compliance, and trust mechanisms that make AgentPay transparent, secure, and trustworthy for users and AI agents.

## Core Principle
**"Trust through transparency"** - Every action AgentPay takes should be explainable, auditable, and reversible.

## Key Components

### 1. Explainability Engine

Generate human-readable explanations for all system decisions.

```python
class ExplainabilityService:
    """Generate explanations for system decisions"""

    def explain_rail_selection(
        self,
        selected_rail: PaymentRail,
        alternatives: list[tuple[PaymentRail, Score]],
        request: PaymentRequest
    ) -> Explanation:
        """
        Explain why a specific payment rail was chosen.

        Example output:
        "You're paying via PIX (Brazil's instant payment system).

        ✓ Funds arrive in seconds
        ✓ Fee: R$ 2.40 (0.4%)
        ✓ Best option: 60% cheaper than Stripe, 3x faster than bank transfer

        Alternative options:
        • Stripe: R$ 24.50 fee (2.9% + R$1.50), instant
        • Bank transfer: Free, but takes 1-2 business days"
        """

    def explain_intent_confidence(
        self,
        detected_intent: TransactionIntent,
        confidence: float,
        extracted_entities: dict
    ) -> Explanation:
        """
        Explain intent detection confidence.

        Example:
        "I detected a payment request with 95% confidence because:
        ✓ You mentioned 'invoice'
        ✓ You specified an amount ($500)
        ✓ You referenced a specific project ('website work')

        Is this correct? [Yes] [No, let me clarify]"
        """

    def explain_compliance_check(
        self,
        result: ComplianceCheckResult
    ) -> Explanation:
        """
        Explain compliance requirements.

        Example:
        "To complete this payment, we need to verify your identity.
        This is required by Brazilian regulations for transactions over R$10,000.

        What we need:
        • Government-issued ID
        • Proof of address (utility bill or bank statement)

        Your data is encrypted and will only be used for verification."
        """

    def explain_fraud_detection(
        self,
        risk_score: float,
        factors: list[RiskFactor]
    ) -> Explanation:
        """
        Explain fraud detection decisions.

        Example:
        "This transaction was flagged for review because:
        ⚠️ Large amount (5x your average transaction)
        ⚠️ New recipient
        ⚠️ Different country than usual

        For your security, we'll need to confirm this is really you.
        [Verify via SMS] [Verify via email]"
        """
```

### 2. Compliance Framework

```
server/polar/trust/compliance/
├── __init__.py
├── service.py                      # Main compliance orchestrator
├── kyc/
│   ├── __init__.py
│   ├── kyc_service.py             # Know Your Customer
│   ├── document_verifier.py       # Verify ID documents
│   ├── identity_providers.py      # Integrate with Onfido, Jumio, etc.
│   └── risk_scoring.py            # KYC risk assessment
├── aml/
│   ├── __init__.py
│   ├── aml_service.py             # Anti-Money Laundering
│   ├── transaction_monitor.py     # Monitor suspicious patterns
│   ├── sanctions_checker.py       # Check sanctions lists
│   └── pep_checker.py             # Politically Exposed Persons check
├── limits/
│   ├── __init__.py
│   ├── limit_enforcer.py          # Enforce transaction limits
│   ├── velocity_checker.py        # Check transaction velocity
│   └── rules_engine.py            # Configurable limit rules
└── reporting/
    ├── __init__.py
    ├── sar_generator.py           # Suspicious Activity Reports
    └── compliance_reporter.py     # Regulatory reports
```

### KYC Implementation

```python
from enum import Enum

class KYCLevel(str, Enum):
    NONE = "none"              # No verification
    BASIC = "basic"            # Email/phone verified
    STANDARD = "standard"      # ID document verified
    ENHANCED = "enhanced"      # Enhanced due diligence

class KYCService:
    """Manage KYC verification process"""

    async def get_required_level(
        self,
        amount: Decimal,
        currency: str,
        country: str,
        user_profile: UserProfile
    ) -> KYCLevel:
        """
        Determine required KYC level based on:
        - Transaction amount
        - Country regulations
        - User's current verification level
        - Cumulative transaction volume
        """

        rules = await self.get_country_rules(country)

        if amount < rules.basic_threshold:
            return KYCLevel.BASIC
        elif amount < rules.standard_threshold:
            return KYCLevel.STANDARD
        else:
            return KYCLevel.ENHANCED

    async def verify_document(
        self,
        user_id: UUID,
        document: UploadedDocument
    ) -> VerificationResult:
        """
        Verify identity document:
        1. Extract data from document (OCR)
        2. Check document authenticity
        3. Compare with user-provided data
        4. Perform liveness check (for photos)
        5. Return verification result
        """

    async def check_compliance(
        self,
        payment_request: PaymentRequest,
        user: User
    ) -> ComplianceCheckResult:
        """
        Check if payment can proceed based on compliance:
        1. Check user's KYC level
        2. Verify transaction limits
        3. Check sanctions lists
        4. Assess AML risk
        5. Return pass/fail with explanation
        """
```

### AML & Fraud Detection

```python
class AMLService:
    """Anti-Money Laundering monitoring"""

    async def monitor_transaction(
        self,
        payment: OrchestrationPayment,
        user: User
    ) -> AMLAssessment:
        """
        Assess transaction for AML risk:
        1. Check amount vs user's profile
        2. Check recipient against sanctions lists
        3. Analyze transaction patterns
        4. Calculate risk score
        5. Trigger alerts if needed
        """

        risk_factors = []

        # Check sanctions
        if await self.is_sanctioned(payment.recipient):
            risk_factors.append(
                RiskFactor("sanctioned_entity", severity=10)
            )

        # Check transaction patterns
        pattern_risk = await self.analyze_patterns(user, payment)
        risk_factors.extend(pattern_risk)

        # Calculate total risk score
        risk_score = sum(f.severity for f in risk_factors)

        if risk_score > THRESHOLD_HIGH:
            # Block transaction and file SAR
            await self.file_suspicious_activity_report(payment, risk_factors)
            return AMLAssessment(
                approved=False,
                risk_score=risk_score,
                reason="High AML risk detected"
            )

        elif risk_score > THRESHOLD_MEDIUM:
            # Request additional verification
            return AMLAssessment(
                approved=False,
                requires_verification=True,
                risk_score=risk_score,
                reason="Additional verification required"
            )

        else:
            return AMLAssessment(
                approved=True,
                risk_score=risk_score
            )

    async def analyze_patterns(
        self,
        user: User,
        payment: OrchestrationPayment
    ) -> list[RiskFactor]:
        """
        Detect suspicious patterns:
        - Structuring (breaking large amounts into smaller ones)
        - Rapid movement of funds
        - Unusual transaction times
        - Sudden change in behavior
        """

class FraudDetectionService:
    """Real-time fraud detection"""

    async def assess_risk(
        self,
        payment: OrchestrationPayment,
        context: ConversationContext
    ) -> FraudAssessment:
        """
        Assess fraud risk using:
        - Device fingerprinting
        - Behavioral analysis
        - Velocity checks
        - Anomaly detection (ML model)
        """

        features = await self.extract_features(payment, context)
        risk_score = await self.ml_model.predict(features)

        if risk_score > 0.8:
            # High fraud risk - require additional verification
            return FraudAssessment(
                risk_score=risk_score,
                action="block_and_verify",
                factors=self.explain_risk_score(features, risk_score)
            )

        elif risk_score > 0.5:
            # Medium risk - add friction
            return FraudAssessment(
                risk_score=risk_score,
                action="add_friction",
                factors=self.explain_risk_score(features, risk_score)
            )

        else:
            return FraudAssessment(
                risk_score=risk_score,
                action="allow"
            )
```

### 3. Audit Logging

```python
class AuditLogger:
    """Comprehensive audit logging for compliance"""

    async def log_action(
        self,
        action: str,
        actor: Actor,  # User, System, AI Agent
        resource: Resource,
        context: dict,
        result: str
    ) -> None:
        """
        Log all actions for audit trail:
        - Who did what
        - When it happened
        - Why it happened
        - What was the outcome
        """

        log_entry = AuditLogEntry(
            id=uuid4(),
            timestamp=datetime.utcnow(),
            action=action,
            actor_type=actor.type,
            actor_id=actor.id,
            resource_type=resource.type,
            resource_id=resource.id,
            context=context,
            result=result,
            ip_address=context.get("ip_address"),
            user_agent=context.get("user_agent")
        )

        await self.repository.create_audit_log(log_entry)

        # Also send to external SIEM if required
        if self.config.siem_enabled:
            await self.siem_client.send_event(log_entry)

# Usage
await audit_logger.log_action(
    action="payment_orchestrated",
    actor=Actor(type="user", id=user.id),
    resource=Resource(type="payment", id=payment.id),
    context={
        "amount": payment.amount,
        "currency": payment.currency,
        "rail": payment.selected_rail,
        "conversation_id": conversation.id
    },
    result="success"
)
```

### 4. Data Privacy & Security

```python
class DataPrivacyService:
    """Handle data privacy and GDPR compliance"""

    async def anonymize_data(
        self,
        data: dict,
        anonymization_level: str
    ) -> dict:
        """
        Anonymize sensitive data for:
        - Analytics
        - ML training
        - Third-party sharing
        """

    async def export_user_data(self, user_id: UUID) -> UserDataExport:
        """
        Export all user data (GDPR right to access):
        - Profile information
        - Conversation history
        - Payment history
        - Audit logs
        """

    async def delete_user_data(self, user_id: UUID) -> None:
        """
        Delete user data (GDPR right to erasure):
        - Mark user as deleted
        - Anonymize personal data
        - Retain transaction data for compliance (7 years)
        """

    async def encrypt_sensitive_data(
        self,
        data: dict,
        fields: list[str]
    ) -> dict:
        """
        Encrypt sensitive fields:
        - PII (names, addresses, phone numbers)
        - Payment details (card numbers, bank accounts)
        - Biometric data
        """
```

### 5. Trust Indicators

Visual indicators to build user trust in the interface:

```python
class TrustIndicator:
    """Generate trust indicators for UI"""

    def get_payment_trust_score(
        self,
        payment: OrchestrationPayment
    ) -> TrustScore:
        """
        Calculate trust score based on:
        - Recipient verification status
        - Payment rail reliability
        - Transaction history
        - Fraud risk assessment
        """

        indicators = []

        # Verified recipient
        if payment.recipient.is_verified:
            indicators.append(
                Indicator(
                    icon="✓",
                    text="Verified recipient",
                    color="green"
                )
            )

        # Secure payment rail
        if payment.rail.security_level == "high":
            indicators.append(
                Indicator(
                    icon="🔒",
                    text="Bank-level security",
                    color="green"
                )
            )

        # Familiar transaction
        if payment.is_similar_to_past_transactions:
            indicators.append(
                Indicator(
                    icon="⟲",
                    text="Similar to past payments",
                    color="blue"
                )
            )

        return TrustScore(
            score=self.calculate_score(indicators),
            indicators=indicators
        )
```

### Database Models

```python
class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id: Mapped[UUID]
    payment_id: Mapped[UUID]
    check_type: Mapped[str]  # kyc, aml, sanctions
    required_level: Mapped[str]
    user_current_level: Mapped[str]
    result: Mapped[str]  # passed, failed, needs_verification
    risk_score: Mapped[float]
    risk_factors: Mapped[list[dict]]  # JSON
    explanation: Mapped[str]
    created_at: Mapped[datetime]

class AuditLogEntry(Base):
    __tablename__ = "audit_logs"

    id: Mapped[UUID]
    timestamp: Mapped[datetime]
    action: Mapped[str]
    actor_type: Mapped[str]  # user, system, ai_agent
    actor_id: Mapped[str]
    resource_type: Mapped[str]
    resource_id: Mapped[str]
    context: Mapped[dict]  # JSON
    result: Mapped[str]
    ip_address: Mapped[str | None]
    user_agent: Mapped[str | None]

class KYCVerification(Base):
    __tablename__ = "kyc_verifications"

    id: Mapped[UUID]
    user_id: Mapped[UUID]
    level: Mapped[str]
    status: Mapped[str]  # pending, approved, rejected
    documents: Mapped[list[dict]]  # JSON
    verified_at: Mapped[datetime | None]
    expires_at: Mapped[datetime | None]
    verification_provider: Mapped[str]  # onfido, jumio, etc.
    external_verification_id: Mapped[str]
    created_at: Mapped[datetime]
```

## Integration Points

### With Payment Orchestration
```python
# Before initiating payment, check compliance
compliance_result = await compliance_service.check_compliance(
    payment_request=request,
    user=user
)

if not compliance_result.approved:
    if compliance_result.requires_verification:
        # Request KYC upgrade
        await kyc_service.request_verification(
            user_id=user.id,
            required_level=compliance_result.required_level,
            explanation=compliance_result.explanation
        )
    else:
        # Block payment
        raise ComplianceException(compliance_result.explanation)

# Continue with payment
payment = await payment_orchestration.initiate_payment(request)
```

### With Conversational Payments
```python
# Add trust indicators to payment confirmation
trust_score = trust_indicator.get_payment_trust_score(payment)

message = f"""
{trust_score.render_indicators()}

Amount: {payment.amount} {payment.currency}
Recipient: {payment.recipient.name}
Method: {payment.rail.display_name}

[Confirm Payment] [Cancel]
"""
```

## Regulatory Compliance

### Brazil (PIX)
- KYC required for transactions > R$ 10,000
- Transaction limits without enhanced KYC
- Report suspicious transactions to COAF

### Australia (PayTo)
- Follow AUSTRAC regulations
- KYC/AML requirements
- Report to AUSTRAC

### Europe (SEPA)
- GDPR compliance
- PSD2 Strong Customer Authentication
- Report to national FIUs

### United States
- FinCEN regulations
- PATRIOT Act compliance
- State-level money transmitter licenses

## Testing Strategy

### Unit Tests
```python
class TestComplianceService:
    async def test_kyc_level_determination(self):
        """Test KYC level selection based on amount"""

    async def test_sanctions_screening(self):
        """Test sanctions list checking"""

    async def test_fraud_detection(self):
        """Test fraud risk scoring"""

class TestExplainability:
    def test_rail_selection_explanation(self):
        """Test generation of rail selection explanation"""

    def test_compliance_explanation(self):
        """Test compliance requirement explanation"""
```

### Compliance Tests
```python
async def test_gdpr_data_export():
    """Test GDPR data export functionality"""

    export = await privacy_service.export_user_data(user_id)

    assert "profile" in export
    assert "conversations" in export
    assert "payments" in export
    assert "audit_logs" in export

async def test_gdpr_data_deletion():
    """Test GDPR right to erasure"""

    await privacy_service.delete_user_data(user_id)

    user = await user_repository.get(user_id)
    assert user.is_deleted
    assert user.email is None  # Anonymized
    assert user.name is None   # Anonymized

    # Payment records retained for compliance
    payments = await payment_repository.get_by_user(user_id)
    assert len(payments) > 0
```

## Success Metrics

### Trust Metrics
- User trust score: > 8/10
- Verification completion rate: > 85%
- False positive rate: < 2%
- User complaint rate: < 0.5%

### Compliance Metrics
- KYC completion time: < 5 minutes
- Compliance check latency: < 100ms
- Suspicious activity detection: > 95%
- Regulatory audit: 100% pass

### Security Metrics
- Fraud detection accuracy: > 98%
- False positive rate: < 1%
- Account takeover prevention: > 99%
- Data breach incidents: 0

## Related Skills
- `payment-orchestration.md` - Integrate compliance checks
- `conversational-payments.md` - Display trust indicators
- `architecture-design.md` - Security architecture

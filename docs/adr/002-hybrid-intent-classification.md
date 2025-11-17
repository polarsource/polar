# ADR 002: Hybrid Intent Classification (Rule-Based + LLM)

**Status**: Accepted

**Date**: 2025-11-17

**Context**:

Agent Core needs to classify user intent from conversational messages to determine appropriate actions. We evaluated three approaches:

1. **Pure Rule-Based**: Regex patterns for all 25 intent types
2. **Pure LLM**: Send every message to Claude/GPT for classification
3. **Hybrid**: Rule-based fast path with LLM fallback

**Key Requirements**:
- **Latency**: <100ms for common intents (greeting, product_query, purchase_intent)
- **Accuracy**: >90% for e-commerce domain intents
- **Cost**: Minimize LLM API calls ($0.01 per 1K tokens)
- **Reliability**: Graceful degradation if LLM API is down

**Decision**:

We will implement **Hybrid Intent Classification**:

```python
class IntentClassifier:
    async def classify(self, message, history, context) -> IntentResult:
        # 1. Rule-based fast path (90% of cases)
        rule_result = self._classify_rules(message)
        if rule_result.confidence > 0.9:
            return rule_result

        # 2. LLM fallback for ambiguous cases
        llm_result = await self._classify_llm(message, history, context)
        return llm_result
```

**Rule-Based Patterns** (25 intents):
```python
PATTERNS = {
    Intent.GREETING: [r"^(hi|hello|hey)"],
    Intent.PRODUCT_QUERY: [r"(looking for|find|search)"],
    Intent.PURCHASE_INTENT: [r"(buy|purchase|add to cart)"],
    Intent.PRICE_NEGOTIATION: [r"(discount|cheaper|can you do)"],
    # ... 21 more patterns
}
```

**LLM Fallback** (Claude Haiku for speed):
- Used when confidence <0.9
- Includes conversation history (last 5 messages)
- Includes context (cart, stage, hesitation_signals)
- 5-10 second timeout with graceful fallback to UNKNOWN intent

**Consequences**:

**Positive**:
- **Fast response**: 90% of intents classified in <50ms (rule-based)
- **Cost efficient**: Only 10% of messages use LLM ($0.001 per message average)
- **High accuracy**: Rules handle clear cases (90%), LLM handles ambiguity (9%), 1% UNKNOWN
- **Offline capable**: Rule-based works even if LLM API is down
- **Explainable**: Rule-based results show matched pattern for debugging

**Negative**:
- **Maintenance overhead**: Need to update regex patterns as new patterns emerge
- **Dual code paths**: Need to test both rule-based and LLM classification
- **Pattern brittleness**: Regex may miss typos or non-standard phrasing
- **Cold start latency**: First LLM call can take 1-2 seconds

**Trade-offs**:
- **Accuracy vs Speed**: We prioritize speed (50ms) over 100% accuracy for common intents
- **Cost vs Quality**: We accept 9-10% LLM usage to handle edge cases well

**Monitoring**:
- Track confidence distribution (how many hit fast path vs LLM)
- Measure latency per path (p50, p95, p99)
- Log misclassifications for pattern improvement

**Future Improvements**:
- Fine-tune small BERT model for intent classification (local, 10ms latency)
- Learn patterns from LLM classifications to expand rule set
- A/B test pure LLM vs hybrid on accuracy/latency

**References**:
- `server/polar/agent_conversation/intent_classifier.py` - Implementation
- `server/polar/agent/enums.py` - Intent definitions

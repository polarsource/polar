import { randomUUID } from "crypto";
import { Webhook } from "standardwebhooks"

import { WebhookCheckoutCreatedPayload$inboundSchema } from "./models/components/webhookcheckoutcreatedpayload.js";
import { SDKValidationError } from "./models/errors/sdkvalidationerror.js";
import { validateEvent, WebhookVerificationError } from "./webhooks.js";

const ORGANIZATION_ID = randomUUID().toString();
const PRODUCT_ID = randomUUID().toString();
const PRICE_ID = randomUUID().toString();

const price = {
    id: PRICE_ID,
    created_at: new Date().toISOString(),
    modified_at: null,
    is_archived: false,
    product_id: PRODUCT_ID,
    price_currency: "usd",
    price_amount: 1000,
    type: "one_time",
    amount_type: "fixed",
};

const product = {
    id: PRODUCT_ID,
    created_at: new Date().toISOString(),
    modified_at: null,
    name: "Product",
    description: null,
    is_recurring: false,
    is_archived: false,
    organization_id: ORGANIZATION_ID,
    prices: [price],
    benefits: [],
    medias: [],
};

const checkoutCreated = {
    type: "checkout.created",
    data: {
        id: randomUUID().toString(),
        created_at: new Date().toISOString(),
        modified_at: null,
        status: "open",
        client_secret: "CLIENT_SECRET",
        url: "https://polar.sh/checkout/CLIENT_SECRET",
        expires_at: new Date().toISOString(),
        success_url: "https://polar.sh/checkout/CLIENT_SECRET/confirmation",
        embed_origin: null,
        tax_amount: 0,
        amount: 1000,
        currency: "usd",
        subtotal_amount: 1000,
        total_amount: 1000,
        product_id: PRODUCT_ID,
        product_price_id: PRICE_ID,
        discount_id: null,
        allow_discount_codes: true,
        is_discount_applicable: true,
        is_free_product_price: false,
        is_payment_required: true,
        is_payment_setup_required: false,
        is_payment_form_required: true,
        customer_id: null,
        customer_name: null,
        customer_email: null,
        customer_ip_address: null,
        customer_billing_address: null,
        customer_tax_id: null,
        payment_processor_metadata: {},
        metadata: {},
        product: product,
        product_price: price,
        discount: null,
        subscription_id: null,
        attached_custom_fields: [],
        custom_field_data: {},
        payment_processor: 'stripe',
        customer_metadata: {},
    }
};

const WEBHOOK_SECRET = "TestSecret";
const WEBHOOK_SECRET_BASE64 = Buffer.from(WEBHOOK_SECRET, 'utf-8').toString('base64');

const getHeaders = (body: string, webhookId: string = "WEBHOOK_ID", timestamp?: Date) => {
    const _timestamp = timestamp || new Date()
    const signature = new Webhook(WEBHOOK_SECRET_BASE64).sign(webhookId, _timestamp, body);
    return {
        "webhook-id": webhookId,
        "webhook-timestamp": Math.floor(_timestamp.getTime() / 1000).toString(),
        "webhook-signature": signature,
    };
};

describe('validateEvent', () => {
    it('should validate signature and parse payload', () => {
        const body = JSON.stringify(checkoutCreated);
        const headers = getHeaders(body);
        const parsed = validateEvent(body, headers, WEBHOOK_SECRET);
        expect(parsed).toEqual(WebhookCheckoutCreatedPayload$inboundSchema.parse(checkoutCreated));
    });

    it('should throw error if signature is invalid', () => {
        const body = JSON.stringify(checkoutCreated);
        const headers = getHeaders(body);
        expect(() => validateEvent(body, headers, "AnotherSecret")).toThrow(WebhookVerificationError);
    });

    it('should throw error if payload is invalid', () => {
        const body = '{"type": "unknown"}';
        const headers = getHeaders(body);

        expect(() => validateEvent(body, headers, WEBHOOK_SECRET)).toThrow(SDKValidationError);
    });
});

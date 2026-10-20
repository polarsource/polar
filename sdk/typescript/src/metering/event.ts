export interface CostMetadataInput {
  amount: number | string;
  currency: string;
}

export interface LLMMetadata {
  vendor: string;
  model: string;
  prompt?: string | null;
  response?: string | null;
  input_tokens: number;
  cached_input_tokens?: number;
  output_tokens: number;
  total_tokens: number;
}

export interface EventMetadataInput {
  _cost?: CostMetadataInput;
  _llm?: LLMMetadata;
  [key: string]: string | number | boolean | CostMetadataInput | LLMMetadata | undefined;
}

export interface ContextualEventInput {
  name: string;
  timestamp?: string;
  organization_id?: string | null;
  external_id?: string | null;
  parent_id?: string | null;
  metadata?: EventMetadataInput;
}

export interface EventCustomerInput extends ContextualEventInput {
  customer_id: string;
  member_id?: string | null;
}

export interface EventExternalCustomerInput extends ContextualEventInput {
  external_customer_id: string;
  external_member_id?: string | null;
}

export type EventInput = EventCustomerInput | EventExternalCustomerInput;

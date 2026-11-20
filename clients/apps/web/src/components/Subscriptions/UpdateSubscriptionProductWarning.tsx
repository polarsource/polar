import { formatTrialEnd, type TrialChangeOutcome } from "@/utils/trial-change";
import { schemas } from "@polar-sh/client";
import { Alert, Text } from "@polar-sh/orbit";
import type { ReactNode } from "react";

const Emphasis = ({ children }: { children: ReactNode }) => (
  <Text as="strong" weight="medium" color="inherit">
    {children}
  </Text>
);

export const UpdateSubscriptionProductWarning = ({
  subscription,
  selectedProduct,
  trialOutcome,
}: {
  subscription: schemas["Subscription"];
  selectedProduct: schemas["Product"];
  trialOutcome: TrialChangeOutcome;
}) => {
  if (selectedProduct.id === subscription.product.id) {
    return null;
  }

  const title =
    trialOutcome?.kind === "ends"
      ? "Trial ends & customer charged immediately"
      : trialOutcome?.kind === "continues"
        ? "Trial continues"
        : "Product change";

  return (
    <Alert
      variant="warning"
      title={title}
      description={
        <>
          {trialOutcome?.kind === "ends" && (
            <>
              This change will end the current trial and{" "}
              <Emphasis>charge the customer immediately</Emphasis> for the first
              billing period of <Emphasis>{selectedProduct.name}</Emphasis>
              .{" "}
            </>
          )}
          {trialOutcome?.kind === "continues" && (
            <>
              The trial will continue until{" "}
              <Emphasis>{formatTrialEnd(trialOutcome.trialEnd)}</Emphasis>. The
              customer won&apos;t be charged before then.{" "}
            </>
          )}
          By updating this subscription, the customer will get access to{" "}
          <Emphasis>{selectedProduct.name}</Emphasis> benefits, and lose access
          to <Emphasis>{subscription.product.name}</Emphasis> benefits.
        </>
      }
    />
  );
};

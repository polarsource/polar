"use client";

import { Text } from "@polar-sh/orbit";
import { Box } from "@polar-sh/orbit/Box";
import Button from "@polar-sh/ui/components/atoms/Button";
import FormattedDateTime from "@polar-sh/ui/components/atoms/FormattedDateTime";
import Pill from "@polar-sh/ui/components/atoms/Pill";
import { formatCurrency } from "@polar-sh/currency";
import { BillingPlan, BillingSubscription } from "./mockData";

const formatPrice = formatCurrency("standard");

const STATUS_LABEL: Record<BillingSubscription["status"], string> = {
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  trialing: "Trial",
};

const STATUS_COLOR: Record<BillingSubscription["status"], "green" | "yellow" | "red" | "blue"> = {
  active: "green",
  past_due: "yellow",
  canceled: "red",
  trialing: "blue",
};

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box display="flex" flexDirection="column" rowGap="xs">
    <Text variant="subtle">{label}</Text>
    <Text>{children}</Text>
  </Box>
);

export const BillingSubscriptionCard = ({
  subscription,
  plan,
  onChangePlan,
}: {
  subscription: BillingSubscription;
  plan: BillingPlan;
  onChangePlan: () => void;
}) => {
  const intervalLabel = plan.interval === "month" ? "month" : "year";

  return (
    <Box
      display="flex"
      flexDirection="column"
      rowGap="2xl"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="xl"
    >
      <Box
        display="flex"
        flexDirection={{ base: "column", md: "row" }}
        rowGap="l"
        justifyContent={{ md: "between" }}
        alignItems={{ md: "start" }}
      >
        <Box display="flex" flexDirection="column" rowGap="s">
          <Box display="flex" alignItems="center" columnGap="s">
            <Text variant="heading-xxs" as="h3">
              {plan.name}
            </Text>
            <Pill color={STATUS_COLOR[subscription.status]}>
              {STATUS_LABEL[subscription.status]}
            </Pill>
            {subscription.cancelAtPeriodEnd && <Pill color="yellow">Cancels at period end</Pill>}
          </Box>
          <Text variant="subtle">{plan.description}</Text>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          rowGap="xs"
          alignItems={{ base: "start", md: "end" }}
        >
          <Box display="flex" alignItems="baseline" columnGap="xs">
            <Text className="text-2xl font-medium" as="span">
              {plan.contactSales
                ? "Custom"
                : plan.amount === 0
                  ? "Free"
                  : formatPrice(plan.amount, plan.currency)}
            </Text>
            {!plan.contactSales && plan.amount > 0 && (
              <Text variant="subtle" as="span">
                / {intervalLabel}
              </Text>
            )}
          </Box>
          {plan.fees.length > 0 && (
            <Text variant="subtle" align="right">
              {plan.fees.join(" · ")}
            </Text>
          )}
        </Box>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
        gap="xl"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingTop="xl"
      >
        <Detail label="Started">
          <FormattedDateTime datetime={subscription.startedAt} />
        </Detail>
        <Detail label={subscription.cancelAtPeriodEnd ? "Ends on" : "Renews on"}>
          <FormattedDateTime datetime={subscription.currentPeriodEnd} />
        </Detail>
        <Detail label="Payment method">
          {subscription.paymentMethod.brand} ending in {subscription.paymentMethod.last4}
        </Detail>
      </Box>

      <Box display="flex" flexDirection="row" flexWrap="wrap" columnGap="m" rowGap="m">
        <Button onClick={onChangePlan}>Change plan</Button>
        <Button variant="ghost" disabled>
          Update payment method
        </Button>
      </Box>
    </Box>
  );
};

"use client";

import { DashboardBody } from "@/components/Layout/DashboardLayout";
import { ConfirmModal } from "@/components/Modal/ConfirmModal";
import { useModal } from "@/components/Modal/useModal";
import { BILLING_PLANS, BillingPlan, BillingPlanId } from "@/components/Settings/Billing/mockData";
import {
  setSubscriptionPlan,
  useBillingSubscription,
} from "@/components/Settings/Billing/useBillingStore";
import { toast } from "@/components/Toast/use-toast";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { schemas } from "@polar-sh/client";
import Button from "@polar-sh/ui/components/atoms/Button";
import Pill from "@polar-sh/ui/components/atoms/Pill";
import { formatCurrency } from "@polar-sh/currency";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";

const formatPrice = formatCurrency("standard");

const PlanCard = ({
  plan,
  isCurrent,
  isSelected,
  onSelect,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isCurrent}
      className={twMerge(
        "dark:border-polar-700 flex h-full flex-col gap-y-8 rounded-2xl border bg-white p-10 text-left transition-colors dark:bg-transparent",
        isCurrent
          ? "dark:bg-polar-800 cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
          : isSelected
            ? "border-blue-500 bg-blue-50/40 dark:border-blue-500 dark:bg-blue-950/20"
            : "cursor-pointer hover:border-gray-300 dark:hover:border-polar-600",
      )}
    >
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-2">
          <h3 className="text-2xl font-medium dark:text-white">{plan.name}</h3>
          {isCurrent && <Pill color="gray">Current</Pill>}
          {plan.highlight && !isCurrent && <Pill color="blue">Popular</Pill>}
        </div>
        <p className="dark:text-polar-400 text-gray-500">{plan.description}</p>
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex items-baseline gap-x-1">
          <span className="text-3xl dark:text-white">
            {plan.contactSales
              ? "Custom"
              : plan.amount === 0
                ? "Free"
                : formatPrice(plan.amount, plan.currency)}
          </span>
          {!plan.contactSales && plan.amount > 0 && (
            <span className="dark:text-polar-400 text-sm text-gray-500">/ {plan.interval}</span>
          )}
        </div>
        {plan.fees.length > 0 && (
          <ul className="dark:text-polar-500 flex flex-col gap-y-0.5 text-gray-500">
            {plan.fees.map((fee) => (
              <li key={fee}>{fee} per transaction</li>
            ))}
          </ul>
        )}
      </div>

      <ul className="dark:border-polar-700 flex flex-col gap-y-2 border-t border-gray-200 pt-8">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-x-2 text-sm">
            <CheckOutlined className="mt-0.5 text-blue-500" fontSize="inherit" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </button>
  );
};

export default function ChangePlanPage({
  organization,
}: {
  organization: schemas["Organization"];
}) {
  const router = useRouter();
  const subscription = useBillingSubscription();
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isShown: isConfirmShown, show: showConfirm, hide: hideConfirm } = useModal();

  const billingHref = `/dashboard/${organization.slug}/settings/billing`;

  const selectablePlans = useMemo(() => BILLING_PLANS.filter((p) => !p.contactSales), []);
  const enterprisePlan = useMemo(() => BILLING_PLANS.find((p) => p.contactSales), []);

  const currentPlan = useMemo(
    () => BILLING_PLANS.find((p) => p.id === subscription.planId),
    [subscription.planId],
  );

  const selectedPlan = useMemo(
    () => BILLING_PLANS.find((p) => p.id === selectedPlanId) ?? null,
    [selectedPlanId],
  );

  const changeKind: "upgrade" | "downgrade" | null = useMemo(() => {
    if (!selectedPlan || !currentPlan) return null;
    if (selectedPlan.amount > currentPlan.amount) return "upgrade";
    if (selectedPlan.amount < currentPlan.amount) return "downgrade";
    return null;
  }, [selectedPlan, currentPlan]);

  const confirmDescription = useMemo(() => {
    if (!selectedPlan || !currentPlan || !changeKind) return "";
    if (changeKind === "upgrade") {
      return `You'll be charged a prorated amount for the rest of the current period and ${formatPrice(
        selectedPlan.amount,
        selectedPlan.currency,
      )} per ${selectedPlan.interval} thereafter.`;
    }
    return `Your ${currentPlan.name} plan will remain active until the end of the current period, then switch to ${selectedPlan.name}.`;
  }, [selectedPlan, currentPlan, changeKind]);

  const performPlanChange = async () => {
    if (!selectedPlanId || !selectedPlan || !changeKind) return;
    setIsSubmitting(true);
    // Simulate API latency for the mocked flow.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubscriptionPlan(selectedPlanId);
    toast({
      title: changeKind === "upgrade" ? "Plan upgraded" : "Plan change scheduled",
      description:
        changeKind === "upgrade"
          ? `You're now on the ${selectedPlan.name} plan.`
          : `You'll move to ${selectedPlan.name} at the end of the current period.`,
    });
    setIsSubmitting(false);
    router.push(billingHref);
  };

  const onContactSales = () => {
    toast({
      title: "Request received",
      description: "Our sales team will be in touch shortly to discuss Enterprise pricing.",
    });
  };

  const ctaLabel =
    changeKind === "upgrade"
      ? "Upgrade plan"
      : changeKind === "downgrade"
        ? "Downgrade plan"
        : "Confirm";

  return (
    <DashboardBody title={null} wide>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-y-4">
          <Link
            href={billingHref}
            className="dark:text-polar-400 dark:hover:text-polar-200 inline-flex w-fit items-center gap-x-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowBackOutlined fontSize="inherit" />
            <span>Back to Billing</span>
          </Link>
          <div className="flex flex-col gap-y-2">
            <h1 className="text-2xl font-medium dark:text-white">Change plan</h1>
            <p className="dark:text-polar-400 text-gray-500">
              Pick a new plan for your Polar subscription. You can change again at any time.
            </p>
          </div>
        </div>

        {enterprisePlan && (
          <div className="dark:bg-polar-800 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gray-50 p-6 md:flex-row md:items-center">
            <div className="flex flex-col gap-y-1">
              <h3 className="text-base font-medium dark:text-white">Need something custom?</h3>
              <p className="dark:text-polar-400 text-sm text-gray-500">
                Talk to our team about Enterprise pricing, volume discounts, and tailored contracts.
              </p>
            </div>
            <Button variant="secondary" onClick={onContactSales}>
              Contact sales
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {selectablePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === subscription.planId}
              isSelected={plan.id === selectedPlanId}
              onSelect={() => setSelectedPlanId(plan.id)}
            />
          ))}
        </div>

        <div className="flex flex-row gap-x-2">
          <Button
            onClick={showConfirm}
            disabled={!changeKind || isSubmitting}
            loading={isSubmitting}
            size="lg"
          >
            {ctaLabel}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => router.push(billingHref)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </div>

      <ConfirmModal
        isShown={isConfirmShown}
        hide={hideConfirm}
        title={ctaLabel}
        description={confirmDescription}
        onConfirm={performPlanChange}
      />
    </DashboardBody>
  );
}

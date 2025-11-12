import { useCallback, useContext, useRef } from "react";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  useCreatePayout,
  useOrganizationAccount,
  usePayoutEstimate,
  useTransactionsSummary,
} from "@/hooks/polar/finance";
import { DetailRow, Details } from "@/components/Shared/Details";
import { Button } from "@/components/Shared/Button";
import { formatCurrencyAndAmount } from "@/utils/money";
import { SlideToAction } from "@/components/Shared/SlideToAction";
import { isEnabled } from "react-native/Libraries/Performance/Systrace";
import React from "react";

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const { organization } = useContext(OrganizationContext);
  const { data: account } = useOrganizationAccount(organization?.id);
  const { data: estimate } = usePayoutEstimate(account?.id);
  const { data: summary } = useTransactionsSummary(account?.id);

  const router = useRouter();

  const { mutateAsync: withdrawFunds, isPending } = useCreatePayout(
    account?.id
  );

  return (
    <>
      <Stack.Screen options={{ title: "Withdraw Funds" }} />
      <SafeAreaView
        style={{
          flex: 1,
          flexDirection: "column",
          gap: 16,
          justifyContent: "space-between",
          margin: 16,
        }}
      >
        <Details>
          <DetailRow
            label="Amount"
            value={formatCurrencyAndAmount(
              estimate?.gross_amount ?? 0,
              summary?.balance.currency
            )}
          />
          <DetailRow
            label="Fees"
            value={formatCurrencyAndAmount(
              estimate?.fees_amount ?? 0,
              summary?.balance.currency
            )}
          />
          <DetailRow
            label="Net"
            value={formatCurrencyAndAmount(
              estimate?.net_amount ?? 0,
              summary?.balance.currency
            )}
          />
        </Details>
        <SlideToAction
          isLoading={isPending}
          text="Slide To Withdraw"
          onSlideStart={() => {
            scrollRef.current?.setNativeProps({ isEnabled: false });
          }}
          onSlideEnd={() => {
            scrollRef.current?.setNativeProps({ isEnabled: true });
          }}
          onSlideComplete={async () => {
            await withdrawFunds({ accountId: account?.id });

            router.replace(`/finance`);
          }}
        />
      </SafeAreaView>
    </>
  );
}

const PayoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
  },
});

import { useTheme } from "@/hooks/theme";
import { formatCurrencyAndAmount } from "@/utils/money";
import { SubscriptionRecurringInterval } from "@polar-sh/sdk/models/components/subscriptionrecurringinterval.js";
import { useMemo } from "react";
import { View, Text } from "react-native";
import { ThemedText } from "../Shared/ThemedText";

interface AmountLabelProps {
  amount: number;
  currency: string;
  interval?: SubscriptionRecurringInterval;
  minimumFractionDigits?: number;
}

const AmountLabel = ({
  amount,
  currency,
  interval,
  minimumFractionDigits = 0,
}: AmountLabelProps) => {
  const { colors } = useTheme();

  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return "";
    }
    switch (interval) {
      case "month":
        return " / mo";
      case "year":
        return " / yr";
      default:
        return "";
    }
  }, [interval]);

  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <ThemedText style={{ fontSize: 14 }}>
        {formatCurrencyAndAmount(amount, currency, minimumFractionDigits)}
      </ThemedText>
      <ThemedText style={{ fontSize: 8 }}>{intervalDisplay}</ThemedText>
    </View>
  );
};

export default AmountLabel;

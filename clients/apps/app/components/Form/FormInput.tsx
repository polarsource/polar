import { Input } from "@/components/Shared/Input";
import { useTheme } from "@/hooks/theme";
import {
  Control,
  FieldValues,
  useController,
  UseControllerProps,
} from "react-hook-form";
import { TextInputProps, View, Text } from "react-native";
import { ThemedText } from "../Shared/ThemedText";

export type FormInputProps<T extends FieldValues> = TextInputProps & {
  control: Control<T>;
  name: UseControllerProps<T>["name"];
  defaultValue?: UseControllerProps<T>["defaultValue"];
  label?: string;
  secondaryLabel?: string;
};

export const FormInput = <T extends FieldValues>({
  control,
  name,
  defaultValue,
  label,
  secondaryLabel,
  ...props
}: FormInputProps<T>) => {
  const { field } = useController({ control, name, defaultValue });
  const { colors, theme } = useTheme();

  if (label) {
    return (
      <View style={{ flexDirection: "column", gap: 8 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <ThemedText style={{ fontSize: 16 }} secondary>
            {label}
          </ThemedText>
          {secondaryLabel && (
            <ThemedText style={{ fontSize: 16 }} secondary>
              {secondaryLabel}
            </ThemedText>
          )}
        </View>
        <Input value={field.value} onChangeText={field.onChange} {...props} />
      </View>
    );
  }

  return (
    <Input
      value={field.value}
      onChangeText={field.onChange}
      placeholderTextColor={colors.subtext}
      {...props}
    />
  );
};

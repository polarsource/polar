import { FormInput } from "@/components/Form/FormInput";
import { Button } from "@/components/Shared/Button";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OrganizationCreate } from "@polar-sh/sdk/models/components/organizationcreate.js";
import { useForm } from "react-hook-form";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { ThemedText } from "@/components/Shared/ThemedText";
import { MotiView } from "moti";
import { useTheme } from "@/hooks/theme";
import { useCreateOrganization } from "@/hooks/polar/organizations";
import { OrganizationContext } from "@/providers/OrganizationProvider";
import { Checkbox } from "@/components/Shared/Checkbox";
import { themes } from "@/utils/theme";
import slugify from "slugify";
import { SDKError } from "@polar-sh/sdk/models/errors/sdkerror.js";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";

export default function Onboarding() {
  const { colors } = useTheme();
  const router = useRouter();
  const { organizations, setOrganization } = useContext(OrganizationContext);

  const form = useForm<OrganizationCreate & { terms: boolean }>({
    defaultValues: {
      name: "",
      slug: "",
      terms: false,
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = form;

  const createOrganization = useCreateOrganization();
  const [editedSlug, setEditedSlug] = useState(false);

  const name = watch("name");
  const slug = watch("slug");
  const terms = watch("terms");

  const isValid = useMemo(() => {
    return name.length > 2 && slug.length > 2 && terms;
  }, [name, slug, terms]);

  useEffect(() => {
    if (!editedSlug && name) {
      setValue("slug", slugify(name, { lower: true, strict: true }));
    } else if (slug) {
      setValue(
        "slug",
        slugify(slug, { lower: true, trim: false, strict: true })
      );
    }
  }, [name, editedSlug, slug, setValue]);

  const onSubmit = useCallback(
    async (data: OrganizationCreate) => {
      const organization = await createOrganization.mutateAsync(data, {
        onError: (error) => {
          if (error instanceof SDKError) {
            setError("root", { message: error.message });
          } else if (error instanceof SDKValidationError) {
            setError("root", { message: error.message });
          } else {
            setError("root", { message: error.message });
          }
        },
      });

      setOrganization(organization);

      router.replace("/");
    },
    [createOrganization, setOrganization, router]
  );

  return (
    <ScrollView
      contentContainerStyle={{ backgroundColor: colors.background }}
      contentInset={{ bottom: 16 }}
    >
      <Stack.Screen
        options={{
          header: () => null,
        }}
      />
      <SafeAreaView style={styles.container}>
        <MotiView
          style={styles.form}
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 500 }}
        >
          <ThemedText style={styles.title}>Create your organization</ThemedText>
          {errors.root && <ThemedText error>{errors.root.message}</ThemedText>}
          <FormInput
            label="Organization Name"
            placeholder="Acme Inc."
            control={control}
            name="name"
          />
          <FormInput
            label="Organization Slug"
            placeholder="acme-inc"
            control={control}
            onFocus={() => setEditedSlug(true)}
            name="slug"
          />
          <Checkbox
            label="I agree to the terms below"
            checked={watch("terms")}
            onChange={(checked) => setValue("terms", checked)}
          />
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "timing", duration: 500 }}
          >
            <View style={{ marginLeft: 4, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <View>
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        "https://docs.polar.sh/merchant-of-record/acceptable-use"
                      )
                    }
                  >
                    <ThemedText style={styles.link}>
                      Acceptable Use Policy
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText secondary>
                    I'll only sell digital products and SaaS that complies with
                    it or risk suspension.
                  </ThemedText>
                </View>
              </View>
              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      "https://docs.polar.sh/merchant-of-record/account-reviews"
                    )
                  }
                >
                  <ThemedText style={styles.link}>Account Reviews</ThemedText>
                </TouchableOpacity>
                <ThemedText secondary>
                  I'll comply with all reviews and requests for compliance
                  materials (KYC/AML).
                </ThemedText>
              </View>
              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://polar.sh/legal/terms")
                  }
                >
                  <ThemedText style={styles.link}>Terms of Service</ThemedText>
                </TouchableOpacity>
              </View>

              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL("https://polar.sh/legal/privacy")
                  }
                >
                  <ThemedText style={styles.link}>Privacy Policy</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </MotiView>
        </MotiView>

        <View style={{ gap: 8 }}>
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: "timing", delay: 250, duration: 500 }}
          >
            <Button onPress={handleSubmit(onSubmit)} disabled={!isValid}>
              Create Organization
            </Button>
          </MotiView>
          {organizations.length > 0 && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: "timing", delay: 250, duration: 500 }}
            >
              <Button onPress={() => router.replace("/")} variant="secondary">
                Back to Dashboard
              </Button>
            </MotiView>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    gap: 32,
  },
  title: {
    fontSize: 56,
    lineHeight: 56,
    paddingVertical: 32,
    fontFamily: "InstrumentSerif_400Regular",
  },
  form: {
    gap: 16,
  },
  link: {
    color: themes.dark.primary,
  },
});

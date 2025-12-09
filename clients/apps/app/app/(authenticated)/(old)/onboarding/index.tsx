import { FormInput } from '@/components/Form/FormInput'
import { Button } from '@/components/Shared/Button'
import { Checkbox } from '@/components/Shared/Checkbox'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useCreateOrganization } from '@/hooks/polar/organizations'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { queryClient } from '@/utils/query'
import { themes } from '@/utils/theme'
import { ClientResponseError, schemas } from '@polar-sh/client'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import slugify from 'slugify'

export default function Onboarding() {
  const { colors } = useTheme()
  const router = useRouter()
  const { organizations, setOrganization } = useContext(OrganizationContext)

  const form = useForm<schemas['OrganizationCreate'] & { terms: boolean }>({
    defaultValues: {
      name: '',
      slug: '',
      terms: false,
    },
  })

  const {
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = form

  const createOrganization = useCreateOrganization()
  const [editedSlug, setEditedSlug] = useState(false)

  const name = watch('name')
  const slug = watch('slug')
  const terms = watch('terms')

  const isValid = useMemo(() => {
    return name.length > 2 && slug.length > 2 && terms
  }, [name, slug, terms])

  useEffect(() => {
    if (!editedSlug && name) {
      setValue('slug', slugify(name, { lower: true, strict: true }))
    } else if (slug) {
      setValue(
        'slug',
        slugify(slug, { lower: true, trim: false, strict: true }),
      )
    }
  }, [name, editedSlug, slug, setValue])

  const onSubmit = useCallback(
    async (data: schemas['OrganizationCreate']) => {
      clearErrors('root')
      try {
        const organization = await createOrganization.mutateAsync(data)
        setOrganization(organization)
        await queryClient.refetchQueries({ queryKey: ['organizations'] })
        router.replace('/')
      } catch (error) {
        if (error instanceof ClientResponseError) {
          const errorDetail = error.error.detail

          if (Array.isArray(errorDetail)) {
            const validationError = errorDetail[0]

            setError('root', { message: validationError.msg })
            return
          }
        }

        setError('root', {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to create organization',
        })
      }
    },
    [clearErrors, createOrganization, setOrganization, router, setError],
  )

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        paddingBottom: 16,
      }}
    >
      <Stack.Screen
        options={{
          header: () => null,
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.form}>
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
            checked={watch('terms')}
            onChange={(checked) => setValue('terms', checked)}
          />
          <View>
            <View style={{ marginLeft: 4, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View>
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        'https://docs.polar.sh/merchant-of-record/acceptable-use',
                      )
                    }
                  >
                    <ThemedText style={styles.link}>
                      Acceptable Use Policy
                    </ThemedText>
                  </TouchableOpacity>
                  <ThemedText secondary>
                    I&apos;ll only sell digital products and SaaS that complies
                    with it or risk suspension.
                  </ThemedText>
                </View>
              </View>
              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(
                      'https://docs.polar.sh/merchant-of-record/account-reviews',
                    )
                  }
                >
                  <ThemedText style={styles.link}>Account Reviews</ThemedText>
                </TouchableOpacity>
                <ThemedText secondary>
                  I&apos;ll comply with all reviews and requests for compliance
                  materials (KYC/AML).
                </ThemedText>
              </View>
              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL('https://polar.sh/legal/terms')
                  }
                >
                  <ThemedText style={styles.link}>Terms of Service</ThemedText>
                </TouchableOpacity>
              </View>

              <View>
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL('https://polar.sh/legal/privacy')
                  }
                >
                  <ThemedText style={styles.link}>Privacy Policy</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View>
            <Button onPress={handleSubmit(onSubmit)} disabled={!isValid}>
              Create Organization
            </Button>
          </View>
          {organizations.length > 0 && (
            <View>
              <Button onPress={() => router.replace('/')} variant="secondary">
                Back to Dashboard
              </Button>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  )
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
    fontFamily: 'InstrumentSerif_400Regular',
  },
  form: {
    gap: 16,
  },
  link: {
    color: themes.dark.primary,
  },
})

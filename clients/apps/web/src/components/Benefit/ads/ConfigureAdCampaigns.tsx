import ImageUpload from '@/components/Form/ImageUpload'
import {
  useUserAdvertisementCampaigns,
  useUserCreateAdvertisementCampaign,
  useUserDeleteAdvertisementCampaign,
  useUserEnableAdvertisementCampaign,
  useUserUpdateAdvertisementCampaign,
} from '@/hooks/queries'
import {
  AdvertisementCampaign,
  BenefitAdsSubscriber,
  UserAdvertisementCampaign,
  UserAdvertisementCampaignCreate,
  UserAdvertisementCampaignUpdate,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'

const ConfigureAdCampaigns = ({
  benefit,
}: {
  benefit: BenefitAdsSubscriber
}) => {
  const { data: campaigns } = useUserAdvertisementCampaigns({ limit: 100 })
  const benefitCampaignId = useMemo(
    () =>
      benefit.grants.length > 0
        ? benefit.grants[0].properties.advertisement_campaign_id
        : undefined,
    [benefit.grants],
  )
  const [selectedCampaign, setSelectedCampaign] = useState<
    UserAdvertisementCampaign | undefined
  >()
  const [create, setCreate] = useState(false)

  const form = useForm<
    UserAdvertisementCampaignCreate | UserAdvertisementCampaignUpdate
  >()
  const { reset } = form

  const onSelectCampaign = useCallback(
    (value: string | 'create') => {
      if (value === 'create') {
        setCreate(true)
        setSelectedCampaign(undefined)
        reset({
          image_url: undefined,
          image_url_dark: undefined,
          link_url: undefined,
          text: undefined,
        })
      } else {
        setCreate(false)
        const campaign = campaigns?.items?.find((c) => c.id === value)
        setSelectedCampaign(campaign)
        reset({ ...campaign })
      }
    },
    [campaigns, reset],
  )

  useEffect(() => {
    if (!benefitCampaignId) {
      return
    }
    onSelectCampaign(benefitCampaignId)
  }, [benefitCampaignId, onSelectCampaign])

  const enable = useUserEnableAdvertisementCampaign()
  const onSubmit = useCallback(
    async (campaign: UserAdvertisementCampaign) => {
      await enable.mutateAsync({
        id: campaign.id,
        body: { benefit_id: benefit.id },
      })
      setCreate(false)
      setSelectedCampaign(campaign)
      reset(campaign)
    },
    [enable, benefit, reset],
  )

  return (
    <div className="relative flex w-full flex-col gap-y-6">
      <h1 className="font-medium">Configure Ad</h1>
      <Select
        value={create ? 'create' : selectedCampaign?.id}
        onValueChange={onSelectCampaign}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an existing campaign" />
        </SelectTrigger>
        <SelectContent>
          {campaigns?.items?.map((campaign) => (
            <SelectItem key={campaign.id} value={campaign.id}>
              {campaign.text}
            </SelectItem>
          ))}
          {campaigns?.items && campaigns?.items?.length > 0 && (
            <SelectSeparator />
          )}
          <SelectItem value="create">Create New Campaign</SelectItem>
        </SelectContent>
      </Select>
      <Form {...form}>
        {selectedCampaign && (
          <EditCampaign
            campaign={selectedCampaign}
            benefit={benefit}
            onSubmit={onSubmit}
          />
        )}
        {create && <CreateCampaign benefit={benefit} onSubmit={onSubmit} />}
      </Form>
    </div>
  )
}

export default ConfigureAdCampaigns

const CreateCampaign = ({
  benefit,
  onSubmit: _onSubmit,
}: {
  benefit: BenefitAdsSubscriber
  onSubmit: (campaign: UserAdvertisementCampaign) => Promise<void>
}) => {
  const create = useUserCreateAdvertisementCampaign()

  const form = useFormContext<UserAdvertisementCampaignCreate>()
  const { handleSubmit } = form

  const onSubmit = useCallback(
    async (
      userAdvertisementCampaignCreate: UserAdvertisementCampaignCreate,
    ) => {
      const campaign = await create.mutateAsync(userAdvertisementCampaignCreate)
      await _onSubmit(campaign)
    },
    [create, _onSubmit],
  )

  return (
    <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
      <div className="relative flex w-full flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormImage
              height={benefit.properties.image_height ?? 100}
              width={benefit.properties.image_width ?? 240}
              name="image_url"
              title="Light Mode"
              description="Image used for light mode"
              required={true}
            />

            <FormImage
              height={benefit.properties.image_height ?? 100}
              width={benefit.properties.image_width ?? 240}
              name="image_url_dark"
              title="Dark Mode"
              description="Image used for dark mode"
              required={false}
            />
          </div>

          <FormLinkURL />
          <FormText />

          <Button type="submit">Create</Button>
        </form>
      </div>
    </div>
  )
}

const EditCampaign = ({
  campaign,
  benefit,
  onSubmit: _onSubmit,
}: {
  campaign: AdvertisementCampaign
  benefit: BenefitAdsSubscriber
  onSubmit: (campaign: UserAdvertisementCampaign) => Promise<void>
}) => {
  const edit = useUserUpdateAdvertisementCampaign(campaign.id)
  const deleteAd = useUserDeleteAdvertisementCampaign(campaign.id)

  const form = useFormContext<UserAdvertisementCampaignUpdate>()
  const { handleSubmit } = form

  const onSubmit = useCallback(
    async (
      userAdvertisementCampaignUpdate: UserAdvertisementCampaignUpdate,
    ) => {
      const updatedCampaign = await edit.mutateAsync(
        userAdvertisementCampaignUpdate,
      )
      await _onSubmit(updatedCampaign)
    },
    [edit, _onSubmit],
  )

  const onDelete = async () => {
    await deleteAd.mutateAsync()
  }

  return (
    <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
      <div className="relative flex w-full flex-col gap-y-12">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormImage
              height={benefit.properties.image_height ?? 100}
              width={benefit.properties.image_width ?? 240}
              name="image_url"
              title="Light Mode"
              description="Image used for light mode"
              required={true}
            />

            <FormImage
              height={benefit.properties.image_height ?? 100}
              width={benefit.properties.image_width ?? 240}
              name="image_url_dark"
              title="Dark Mode"
              description="Image used for dark mode"
              required={false}
            />
          </div>

          <FormLinkURL />
          <FormText />

          <div className="flex gap-2">
            <Button type="submit" loading={edit.isPending}>
              Save
            </Button>
            <Button
              variant={'destructive'}
              onClick={onDelete}
              loading={deleteAd.isPending}
            >
              Remove Ad
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FormImage = ({
  height,
  width,
  name,
  title,
  description,
  required,
}: {
  height: number
  width: number
  name: 'image_url' | 'image_url_dark'
  title: string
  description?: string
  required: boolean
}) => {
  const { control } = useFormContext<UserAdvertisementCampaignCreate>()

  const expectedSizes = [
    [width, height],
    [width * 2, height * 2],
    [width * 3, height * 3],
  ]

  return (
    <FormField
      control={control}
      name={name}
      rules={{
        required: required ? 'This field is required' : undefined,
        minLength: 3,
        pattern: /^https:\/\//,
      }}
      render={({ field }) => {
        return (
          <FormItem className="flex flex-col gap-y-2">
            <div className="flex flex-col gap-y-2">
              <FormLabel>{title}</FormLabel>
              {description && (
                <p className="dark:text-polar-400 text-sm text-gray-600">
                  {description}
                </p>
              )}
            </div>
            <FormControl>
              <ImageUpload
                onUploaded={field.onChange}
                defaultValue={field.value}
                width={expectedSizes[0][0]}
                height={expectedSizes[0][1]}
                validate={(el) => {
                  if (el.naturalWidth === 0 && el.naturalHeight === 0) {
                    return undefined
                  }

                  const size = [el.naturalWidth, el.naturalHeight]

                  for (const expect of expectedSizes) {
                    if (expect[0] === size[0] && expect[1] === size[1]) {
                      return undefined
                    }
                  }

                  return `Expected an image with a resolution of ${expectedSizes
                    .map((v) => v.join('x'))
                    .join(' or ')}. Got ${size.join('x')}.`
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormLinkURL = ({}) => {
  const { control } = useFormContext<UserAdvertisementCampaignCreate>()
  return (
    <FormField
      control={control}
      name="link_url"
      rules={{
        required: 'This field is required',
        minLength: 3,
        pattern: /^https:\/\//,
      }}
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Link</FormLabel>
            </div>
            <FormControl>
              <Input type="text" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormText = ({}) => {
  const { control } = useFormContext<UserAdvertisementCampaignCreate>()
  return (
    <FormField
      control={control}
      name="text"
      rules={{
        required: 'This field is required',
        minLength: 3,
      }}
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Text</FormLabel>
            </div>
            <FormControl>
              <Input type="text" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

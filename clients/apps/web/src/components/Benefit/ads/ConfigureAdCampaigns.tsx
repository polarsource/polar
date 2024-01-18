import ImageUpload from '@/components/Form/ImageUpload'
import {
  AdvertisementCampaign,
  CreateAdvertisementCampaign,
  EditAdvertisementCampaign,
  SubscriptionSubscriber,
} from '@polar-sh/sdk'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import {
  useAdvertisementCampaigns,
  useCreateAdvertisementCampaigns,
  useEditAdvertisementCampaigns,
} from 'polarkit/hooks'
import { useForm, useFormContext } from 'react-hook-form'
import { BenefitSubscriber } from '../Benefit'

const ConfigureAdCampaigns = ({
  benefit,
  subscription,
}: {
  benefit: BenefitSubscriber
  subscription: SubscriptionSubscriber
}) => {
  const campaigns = useAdvertisementCampaigns(subscription.id)

  const camps = campaigns.data?.items ?? []

  return (
    <div>
      {camps.map((c) => (
        <EditCampaign campaign={c} key={c.id} />
      ))}
      <hr />
      <CreateCampaign subscription={subscription} />
    </div>
  )
}

export default ConfigureAdCampaigns

const CreateCampaign = ({
  subscription,
}: {
  subscription: SubscriptionSubscriber
}) => {
  const create = useCreateAdvertisementCampaigns()

  const form = useForm<CreateAdvertisementCampaign>({
    defaultValues: {
      subscription_id: subscription.id,
    },
  })
  const { handleSubmit } = form

  const onSubmit = async (
    createAdvertisementCampaign: CreateAdvertisementCampaign,
  ) => {
    await create.mutateAsync({
      createAdvertisementCampaign,
    })
  }

  return (
    <div>
      <Form {...form}>
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="relative flex w-full flex-col gap-y-12 md:w-2/3">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-8 flex items-center justify-between">
                <h1 className="text-lg font-medium">Create ad</h1>
              </div>

              <FormFormat />
              <FormImageURL />
              <FormLinkURL />
              <FormText />

              <Button type="submit">Create</Button>
            </form>
          </div>
        </div>
      </Form>
    </div>
  )
}

const EditCampaign = ({ campaign }: { campaign: AdvertisementCampaign }) => {
  const edit = useEditAdvertisementCampaigns()

  const form = useForm<EditAdvertisementCampaign>({
    defaultValues: {
      ...campaign,
    },
  })
  const { handleSubmit } = form

  const onSubmit = async (
    editAdvertisementCampaign: EditAdvertisementCampaign,
  ) => {
    await edit.mutateAsync({
      id: campaign.id,
      editAdvertisementCampaign,
    })
  }

  return (
    <div>
      <Form {...form}>
        <div className="flex flex-col items-start justify-between gap-12 md:flex-row">
          <div className="relative flex w-full flex-col gap-y-12 md:w-2/3">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="mb-8 flex items-center justify-between">
                <h1 className="text-lg font-medium">Edit ad</h1>
              </div>

              <FormFormat />
              <FormImageURL />
              <FormLinkURL />
              <FormText />

              <Button type="submit">Save</Button>
            </form>
          </div>
        </div>
      </Form>
    </div>
  )
}

const FormFormat = ({}) => {
  const { control } = useFormContext<CreateAdvertisementCampaign>()
  return (
    <FormField
      control={control}
      name="format"
      rules={{
        required: 'This field is required',
      }}
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Format</FormLabel>
            </div>
            <FormControl>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ad format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rect">Rect</SelectItem>
                  <SelectItem value="small_leaderboard">
                    Small leaderboard
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormImageURL = ({}) => {
  const { control } = useFormContext<CreateAdvertisementCampaign>()
  return (
    <FormField
      control={control}
      name="image_url"
      rules={{
        required: 'This field is required',
        minLength: 3,
      }}
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Image</FormLabel>
            </div>
            <ImageUpload
              onUploaded={field.onChange}
              defaultValue={field.value}
            />
            <FormControl>
              <Input
                type="text"
                onChange={field.onChange}
                defaultValue={field.value}
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
  const { control } = useFormContext<CreateAdvertisementCampaign>()
  return (
    <FormField
      control={control}
      name="link_url"
      rules={{
        required: 'This field is required',
        minLength: 3,
      }}
      render={({ field }) => {
        return (
          <FormItem>
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Link</FormLabel>
            </div>
            <FormControl>
              <Input
                type="text"
                onChange={field.onChange}
                defaultValue={field.value}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

const FormText = ({}) => {
  const { control } = useFormContext<CreateAdvertisementCampaign>()
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
              <Input
                type="text"
                onChange={field.onChange}
                defaultValue={field.value}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

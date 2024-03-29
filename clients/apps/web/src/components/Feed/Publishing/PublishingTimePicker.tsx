import { ArticleUpdate } from '@polar-sh/sdk'
import { FormField, FormItem, FormMessage } from 'polarkit/components/ui/form'
import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { DateTimePicker } from './DateTimePicker'

export const PublishingTimePicker = () => {
  const { control } = useFormContext<ArticleUpdate>()

  return (
    <FormField
      control={control}
      name="published_at"
      render={({ field }) => {
        const publish = field.value ? 'schedule' : 'publish-now'

        return (
          <FormItem>
            <div className="flex flex-col gap-y-4">
              <div className="flex items-start justify-between gap-y-2">
                <span className="font-medium">Publishing</span>
              </div>

              <RadioGroup
                value={publish}
                onValueChange={(value) => {
                  const v = value === 'publish-now' ? null : new Date()
                  field.onChange(v)
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="publish-now" id="publish-now" />
                  <Label
                    className={twMerge('capitalize')}
                    htmlFor="publish-now"
                  >
                    Publish Now
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="schedule" id="schedule" />
                  <Label className={twMerge('capitalize')} htmlFor="schedule">
                    Schedule
                  </Label>
                </div>
              </RadioGroup>

              {publish === 'schedule' ? (
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-row justify-between">
                    <DateTimePicker
                      date={field.value ? new Date(field.value) : new Date()}
                      canSelectFuture={true}
                      canSelectPast={true}
                      onChange={field.onChange}
                    />
                  </div>
                </div>
              ) : null}

              <FormMessage />
            </div>
          </FormItem>
        )
      }}
    />
  )
}

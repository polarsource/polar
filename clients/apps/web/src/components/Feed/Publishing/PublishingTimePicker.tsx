import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { twMerge } from 'tailwind-merge'
import { DateTimePicker } from './DateTimePicker'

export interface PublishingPickerProps {
  publishAt: Date | undefined
  onChange: (v: Date | undefined) => void
}

export const PublishingTimePicker = ({
  publishAt,
  onChange,
}: PublishingPickerProps) => {
  const publish = publishAt ? 'schedule' : 'publish-now'

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between gap-y-2">
        <span className="font-medium">Publishing</span>
      </div>

      <RadioGroup
        value={publish}
        onValueChange={(value) => {
          onChange(value === 'publish-now' ? undefined : new Date())
        }}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="publish-now" id="publish-now" />
          <Label className={twMerge('capitalize')} htmlFor="publish-now">
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

      {publish === 'schedule' && (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row justify-between">
            <DateTimePicker
              date={publishAt}
              canSelectFuture={true}
              canSelectPast={true}
              onChange={onChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}

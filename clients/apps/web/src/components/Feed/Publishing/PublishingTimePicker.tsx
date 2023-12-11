import { Article } from '@polar-sh/sdk'
import { Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

export interface PublishingPickerProps {
  publishAt: Date | undefined
  article: Article
  onChange: (v: Date | undefined) => void
  onReset: () => void
}

export const PublishingTimePicker = ({
  publishAt,
  article,
  onChange,
  onReset,
}: PublishingPickerProps) => {
  const [publish, setPublish] = useState('publish-now')

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-start justify-between gap-y-2">
        <span className="font-medium">Publishing</span>
      </div>

      <RadioGroup value={publish} onValueChange={(value) => setPublish(value)}>
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
            {publishAt ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={onReset}
                  variant={'ghost'}
                  className="m-0 h-auto p-0"
                >
                  Reset
                </Button>

                <Button
                  onClick={() => onChange(new Date())}
                  variant={'outline'}
                  className="m-0 h-auto "
                >
                  Now
                </Button>
              </div>
            ) : null}
          </div>
          {publishAt ? (
            <div>
              <span className="text-sm font-medium">
                {publishAt < new Date() ? 'Published' : 'Publishing'}{' '}
                <PolarTimeAgo date={publishAt} />
              </span>
              <div className="grid w-fit grid-cols-2 text-sm">
                <div className="font-medium">Your time zone</div>
                <div className="text-gray-500">
                  {publishAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  at{' '}
                  {publishAt.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </div>

                <div className="font-medium">UTC</div>
                <div className="text-gray-500">
                  {publishAt.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}{' '}
                  at{' '}
                  {publishAt.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                    timeZone: 'UTC',
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useCallback, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface AudiencePickerProps {
  paidSubscribersOnly: boolean
  onChange: (paidSubscribersOnly: boolean) => void
}

export const AudiencePicker = ({
  paidSubscribersOnly,
  onChange,
}: AudiencePickerProps) => {
  const handleAudienceChange = useCallback(
    (audience: string) => {
      onChange(audience === 'premium-subscribers')
    },
    [onChange],
  )

  const audience = useMemo(
    () => (paidSubscribersOnly ? 'premium-subscribers' : 'all-subscribers'),
    [paidSubscribersOnly],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Audience</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Pick the audience for this post
        </p>
      </div>
      <RadioGroup value={audience} onValueChange={handleAudienceChange}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all-subscribers" id="all-subscribers" />
          <Label className={twMerge('capitalize')} htmlFor="all-subscribers">
            All Subscribers
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem
            value="premium-subscribers"
            id="premium-subscribers"
          />
          <Label
            className={twMerge('capitalize')}
            htmlFor="premium-subscribers"
          >
            Premium Subscribers
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

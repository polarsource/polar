'use client'

import { enums, schemas } from '@polar-sh/client'
import { METER_UNIT_DISPLAY_NAMES } from '@polar-sh/ui/lib/meterUnit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { InfoIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

const MeterFormUnit = () => {
  const { control, watch } = useFormContext<schemas['MeterCreate']>()
  const unit = watch('unit')

  return (
    <>
      <FormField
        control={control}
        name="unit"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="flex items-center gap-x-1.5">
                Unit
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="dark:text-polar-400 h-3.5 w-3.5 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Controls how prices are formatted for display. For example,
                    selecting &ldquo;Token&rdquo; shows prices as
                    $20&thinsp;/&thinsp;1M tokens instead of a raw per-token
                    amount.
                  </TooltipContent>
                </Tooltip>
              </span>
            </FormLabel>
            <FormDescription>
              Determines what the aggregated value represents.
            </FormDescription>
            <FormControl>
              <Select
                value={field.value ?? 'scalar'}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {enums.meterUnitValues.map((u) => (
                    <SelectItem key={u} value={u}>
                      {METER_UNIT_DISPLAY_NAMES[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {unit === 'custom' && (
        <div className="grid grid-cols-2 gap-x-3">
          <FormField
            control={control}
            name="custom_label"
            rules={{ required: 'Required for custom unit' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <span className="flex items-center gap-x-1.5">
                    Unit label
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="dark:text-polar-400 h-3.5 w-3.5 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The singular name shown after the price, e.g.
                        &ldquo;gigabyte&rdquo; displays as
                        $0.023&thinsp;/&thinsp;gigabyte.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    placeholder="gigabyte"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="custom_multiplier"
            rules={{
              min: { value: 1, message: 'Must be at least 1' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <span className="flex items-center gap-x-1.5">
                    Unit Multiplier
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="dark:text-polar-400 h-3.5 w-3.5 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Scales how the price is displayed. For example, a
                        multiplier of 1&thinsp;000 shows the price per
                        1&thinsp;000 units rather than per single unit.
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    step={1}
                    value={field.value ?? 1}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : 1,
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </>
  )
}

export default MeterFormUnit

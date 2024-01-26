'use client'

import { Command } from 'cmdk'
import { countries } from 'countries-list'
import { CONFIG } from 'polarkit'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { Check, ChevronsUpDown } from 'lucide-react'
import React from 'react'
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '../command'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'
import Button from './Button'

const countryWhiteList = CONFIG.STRIPE_COUNTRIES_WHITELIST_CSV.split(',')

const availableCountries = Object.entries(countries)
  .sort((a, b) => {
    return a[1].name.localeCompare(b[1].name)
  })
  .filter(([countryCode]) => countryWhiteList.includes(countryCode))

const CountryPicker = ({
  onSelectCountry,
}: {
  onSelectCountry: (countryCode: string) => void
}) => {
  const onChange = (val: string) => {
    onSelectCountry(val)
    setValue(val)
  }

  const [value, setValue] = useState('US')
  const [open, setOpen] = React.useState(false)

  const currentCountry = availableCountries.find(
    ([countryCode]) => countryCode === value,
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          raw={true}
          className="w-full"
        >
          <div className="inline-flex w-full items-center justify-between">
            {currentCountry ? (
              <span className="flex-1  text-left">
                {currentCountry[1].emoji} {currentCountry[1].name}
              </span>
            ) : (
              <span className="flex-1 text-left">Select country</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="-mt-10 w-[400px] p-0 lg:min-w-[600px]"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search country..." className="my-2 h-8" />
          <CommandEmpty>No country found.</CommandEmpty>
          <CommandGroup>
            {availableCountries.map(([countryCode, country]) => (
              <CommandItem
                key={countryCode}
                value={country.name}
                onSelect={() => {
                  onChange(countryCode)
                  setOpen(false)
                }}
              >
                <Check
                  className={twMerge(
                    'mr-2 h-4 w-4',
                    value === countryCode ? 'opacity-100' : 'opacity-0',
                  )}
                />
                {country.emoji} {country.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default CountryPicker

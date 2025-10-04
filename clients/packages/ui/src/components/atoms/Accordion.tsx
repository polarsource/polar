'use client'

import * as React from 'react'

import {
  Accordion as ShadAccordion,
  AccordionContent as ShadAccordionContent,
  AccordionItem as ShadAccordionItem,
  AccordionTrigger as ShadAccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

const Accordion = ShadAccordion

const AccordionItem = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof ShadAccordionItem>) => (
  <ShadAccordionItem
    ref={ref}
    className={cn('rounded-2xl! px-3', className)}
    {...props}
  />
)
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = ({
  ref,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ShadAccordionTrigger>) => (
  <ShadAccordionTrigger
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  >
    {children}
  </ShadAccordionTrigger>
)
AccordionTrigger.displayName = ShadAccordionTrigger.displayName

const AccordionContent = ({
  ref,
  children,
  ...props
}: React.ComponentProps<typeof ShadAccordionContent>) => (
  <ShadAccordionContent ref={ref} {...props}>
    {children}
  </ShadAccordionContent>
)

AccordionContent.displayName = ShadAccordionContent.displayName

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }

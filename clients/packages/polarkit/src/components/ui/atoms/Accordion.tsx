'use client'

import * as React from 'react'

import { cn } from '@polarkit/lib/utils'
import {
  Accordion as ShadAccordion,
  AccordionContent as ShadAccordionContent,
  AccordionItem as ShadAccordionItem,
  AccordionTrigger as ShadAccordionTrigger,
} from '../accordion'

const Accordion = ShadAccordion

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof ShadAccordionItem>,
  React.ComponentPropsWithoutRef<typeof ShadAccordionItem>
>(({ className, ...props }, ref) => (
  <ShadAccordionItem
    ref={ref}
    className={cn('!rounded-2xl px-3', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof ShadAccordionTrigger>,
  React.ComponentPropsWithoutRef<typeof ShadAccordionTrigger>
>(({ className, children, ...props }, ref) => (
  <ShadAccordionTrigger
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  >
    {children}
  </ShadAccordionTrigger>
))
AccordionTrigger.displayName = ShadAccordionTrigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof ShadAccordionContent>,
  React.ComponentPropsWithoutRef<typeof ShadAccordionContent>
>(({ children, ...props }, ref) => (
  <ShadAccordionContent ref={ref} {...props}>
    {children}
  </ShadAccordionContent>
))

AccordionContent.displayName = ShadAccordionContent.displayName

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }

'use client'

import { SubscriptionTier } from '@polar-sh/sdk'
import { Button } from 'polarkit/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'polarkit/components/ui/dialog'
import { Input } from 'polarkit/components/ui/input'
import { Label } from 'polarkit/components/ui/label'
import React, { useCallback } from 'react'

interface SubscriptionTierDialogProps {
  subscriptionTier?: SubscriptionTier
  open: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (data: {
    name: string
    description: string
    price_amount: number
  }) => void
}

const SubscriptionTierDialog: React.FC<SubscriptionTierDialogProps> = ({
  subscriptionTier,
  open,
  onOpenChange,
  onSubmit: _onSubmit,
}) => {
  const onSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault()
      if (_onSubmit) {
        const formData = new FormData(e.currentTarget)
        _onSubmit({
          name: formData.get('name')?.toString() as string,
          description: formData.get('description')?.toString() as string,
          price_amount:
            Number.parseInt(
              formData.get('price_amount')?.toString() as string,
            ) * 100,
        })
      }
    },
    [_onSubmit],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {subscriptionTier ? 'Update tier' : 'Create tier'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} id="subscription-tier-form">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                type="text"
                id="name"
                name="name"
                required
                defaultValue={subscriptionTier?.name}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                type="text"
                id="description"
                name="description"
                required
                defaultValue={subscriptionTier?.description}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price_amount" className="text-right">
                Pricing
              </Label>
              <Input
                type="number"
                id="price_amount"
                name="price_amount"
                required
                defaultValue={
                  subscriptionTier
                    ? subscriptionTier.price_amount / 100
                    : undefined
                }
                min={0}
                className="col-span-3"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="subscription-tier-form">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SubscriptionTierDialog

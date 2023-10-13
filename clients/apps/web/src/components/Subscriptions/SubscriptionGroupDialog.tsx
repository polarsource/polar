'use client'

import { SubscriptionGroup } from '@polar-sh/sdk'
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

interface SubscriptionGroupDialogProps {
  subscriptionGroup?: SubscriptionGroup
  open: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (data: { name: string }) => void
}

const SubscriptionGroupDialog: React.FC<SubscriptionGroupDialogProps> = ({
  subscriptionGroup,
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
            {subscriptionGroup ? 'Update tiers group' : 'Create tiers group'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} id="subscription-group-form">
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
                defaultValue={subscriptionGroup?.name}
                className="col-span-3"
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="subscription-group-form">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SubscriptionGroupDialog

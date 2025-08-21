'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { ProviderDefinition, providers, models, ModelDefinition, ProviderId } from '@polar-sh/models'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@polar-sh/ui/components/atoms/Select'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useState } from 'react'

export default function OverviewPage() {
  return (
    <DashboardBody className="flex flex-col gap-y-12" wrapperClassName='!max-w-screen-sm'>
      <div className="flex flex-col gap-y-2">
      {providers.map((provider) => (
        <ProviderRow key={provider.id} provider={provider} />
      ))}
      </div>
    </DashboardBody>
  )
}

const ProviderRow = ({ provider }: { provider: ProviderDefinition }) => {
const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex flex-col gap-y-2">
      <div role='button' onClick={() => setIsOpen(!isOpen)} className="flex flex-col gap-x-4 bg-gray-100 dark:bg-polar-800 p-6 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-polar-700 transition-colors">
        <h2>{provider.name}</h2>
        <p className="text-sm text-gray-500 dark:text-polar-500">{provider.description}</p>
      </div>
      {isOpen && (
        <div className="flex flex-col gap-y-2 py-4">
          {models.filter((model) => model.providers.some((p) => p.providerId === provider.id)).map((model) => (
            <ModelRow key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  )
}

const ModelRow = ({ model }: { model: ModelDefinition }) => {
  const {isShown: isModalShown, show: showModal, hide: hideModal} = useModal()

  return (
    <div role='button' onClick={showModal} className="flex flex-col border cursor-pointer border-gray-200 dark:border-polar-700 px-6 py-4 rounded-xl hover:bg-gray-100 dark:hover:bg-polar-700 transition-colors">
      <div className="flex flex-row justify-between gap-x-4">
        <h2 className="text-sm">{model.name}</h2>
        <span className="text-sm text-gray-500 dark:text-polar-500 capitalize">{model.family}</span>
      </div>
      <Modal
      className='lg:w-[640px]' 
      modalContent={<ModelModal model={model} />} isShown={isModalShown} hide={hideModal} />
    </div>
  )
}

const ModelModal = ({ model }: { model: ModelDefinition }) => {
  const [selectedProviderId, setSelectedProviderId] = useState(model.providers[0].providerId)

  const selectedProvider = model.providers.find((p) => p.providerId === selectedProviderId)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col p-6">
        <h2 className="text-lg font-medium">{model.name}</h2>
        <p className="capitalize text-gray-500 dark:text-polar-500">{model.family}</p>
      </div>
      <Separator />
      <div className="flex flex-col gap-y-2 p-6">
        <h3 className="text-sm font-medium">Provider</h3>
        <Select value={selectedProviderId} onValueChange={(value) => setSelectedProviderId(value as ProviderId)}>
          <SelectTrigger  className='capitalize'>
            <SelectValue placeholder="Select a provider" />
          </SelectTrigger>
          <SelectContent>
            {model.providers.map((provider) => (
              <SelectItem key={provider.providerId}  className='capitalize' value={provider.providerId}>{provider.providerId}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div> 
      <Separator />
      <div className="flex flex-col gap-y-2 p-6">
        <div className="grid grid-cols-3 gap-y-2">
          <div className="flex flex-col gap-y-1">
            
        <h3 className="text-sm font-medium text-gray-500 dark:text-polar-500">Context Size</h3>
            <span>{Intl.NumberFormat('en-US', { maximumFractionDigits: 2, notation: 'compact' }).format(selectedProvider?.contextSize ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-y-1">
            
        <h3 className="text-sm font-medium text-gray-500 dark:text-polar-500">Input Price</h3>
            <span>{selectedProvider?.inputPrice ? `$${selectedProvider?.inputPrice * 1000000}/M` : 'N/A'}</span>
          </div>
          <div className="flex flex-col gap-y-1">
           
        <h3 className="text-sm font-medium text-gray-500 dark:text-polar-500">Output Price</h3>
            <span>{selectedProvider?.outputPrice ? `$${selectedProvider?.outputPrice * 1000000}/M` : 'N/A'}</span>
          </div>
        </div>
      </div> 
    </div>
  )
}
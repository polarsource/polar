'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { ProviderDefinition, providers, models, ModelDefinition } from '@polar-sh/models'
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
        <div className="flex flex-col gap-y-2">
          {models.filter((model) => model.providers.some((p) => p.providerId === provider.id)).map((model) => (
            <ModelRow key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  )
}

const ModelRow = ({ model }: { model: ModelDefinition }) => {
  return (
    <div className="flex flex-row gap-x-4 border cursor-pointer border-gray-200 dark:border-polar-700 p-6 rounded-xl hover:bg-gray-100 dark:hover:bg-polar-700 transition-colors">
      <div className="flex flex-col">
        <h2 className="text-sm">{model.name}</h2>
        <p className="text-sm text-gray-500 dark:text-polar-500">{model.family}</p>
      </div>
    </div>
  )
}
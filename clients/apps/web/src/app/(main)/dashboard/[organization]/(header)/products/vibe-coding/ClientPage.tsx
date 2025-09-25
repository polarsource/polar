'use client'

import EyeIcon from '@/components/Icons/EyeIcon'
import EyeOffIcon from '@/components/Icons/EyeOffIcon'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect from '@/components/Products/ProductSelect'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useCreateOrganizationAccessToken } from '@/hooks/queries'
import { useSelectedProducts } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
}

interface PricingPageConfig {
  selectedProducts: string[]
  successPath: string
}

interface CustomerPortalConfig {
  // No configuration needed for customer portal
}

interface Template<T = any> {
  id: string
  name: string
  description: string
  defaultConfig: T
  generatePrompt: (config: T, accessToken: string, products?: schemas['Product'][]) => string
}

type TemplateId = 'pricing-page' | 'customer-portal'
type TemplateConfig = PricingPageConfig | CustomerPortalConfig

const TEMPLATES: Record<TemplateId, Template> = {
  'pricing-page': {
    id: 'pricing-page',
    name: 'Pricing Page',
    description: 'Generate a modern, responsive pricing page with Polar checkout integration',
    defaultConfig: {
      selectedProducts: [],
      successPath: '/success'
    } as PricingPageConfig,
    generatePrompt: (config: PricingPageConfig, accessToken: string, products?: schemas['Product'][]) => {
      if (!products || products.length === 0) {
        return 'Select products above to generate a prompt for your pricing page.'
      }

      const productList = products
        .map((product) => {
          return `- **${product.name}**
  - ID: ${product.id}
  - Type: ${product.is_recurring ? 'Subscription' : 'One-time purchase'}
  - Description: ${product.description || 'No description'}${
    product.prices?.length
      ? `
  - Pricing: ${product.prices
    .map((price: any) => {
      if (price.amount_type === 'free') return 'Free'
      if (price.amount_type === 'custom') return 'Pay what you want'
      if (
        price.amount_type === 'fixed' &&
        'price_amount' in price &&
        price.price_amount
      ) {
        let priceStr = `$${price.price_amount / 100}${price.price_currency ? ` ${price.price_currency.toUpperCase()}` : ''}`
        if (
          product.is_recurring &&
          'recurring_interval' in price &&
          price.recurring_interval
        ) {
          priceStr += `/${price.recurring_interval}`
        }
        return priceStr
      }
      if (
        price.amount_type === 'metered_unit' &&
        'unit_amount' in price &&
        price.unit_amount
      ) {
        let priceStr = `$${parseFloat(price.unit_amount) / 100}${price.price_currency ? ` ${price.price_currency.toUpperCase()}` : ''}`
        if ('meter' in price && price.meter && price.meter.name) {
          priceStr += ` per ${price.meter.name}`
        } else {
          priceStr += ` per unit`
        }
        return priceStr
      }
      return 'Contact for pricing'
    })
    .join(', ')}`
      : ''
  }`
        })
        .join('\n\n')

      return `Create a modern, responsive pricing page that integrates with Polar's payment infrastructure. The page should display the following products:

${productList}

Design a clean, modern pricing page that shows each product with its name, description, and pricing information.
Include prominent call-to-action buttons for each product and ensure the design is responsive and visually appealing.

When a user clicks on a product's purchase button, you'll need to create a checkout session using Polar's API.
To authenticate with Polar, use this organization access token: ${accessToken}. Make sure to store this access token in a secure way.

The checkout creation endpoint is documented at https://polar.sh/docs/api-reference/checkouts/create-session.md

Here's how to implement the checkout API integration:

\`\`\`javascript
// Create checkout session for selected product
const response = await fetch('https://api.polar.sh/v1/checkouts/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${accessToken}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    products: [SELECTED_PRODUCT_ID], // Single product ID from the clicked product
    success_url: '\${DOMAIN}${config.successPath}?checkout_id={CHECKOUT_ID}' // Prefix this with the domain of this app
  })
})

const checkout = await response.json()
// Redirect user to: checkout.url
\`\`\`

You'll also need to create a success page at \`${config.successPath}?checkout_id={CHECKOUT_ID}\` that validates the checkout session when users return after payment.
The success page should extract the checkout_id from the URL query parameters and validate the session using Polar's checkout retrieval endpoint documented at https://polar.sh/docs/api-reference/checkouts/get-session.md:

\`\`\`javascript
// Get checkout_id from URL query parameters
const checkoutId = new URLSearchParams(window.location.search).get('checkout_id')

// Validate the checkout session
const response = await fetch(\`https://api.polar.sh/v1/checkouts/\${checkoutId}\`, {
  headers: {
    'Authorization': 'Bearer ${accessToken}'
  }
})

const checkout = await response.json()

// Check if payment was successful
if (checkout.status === 'succeeded') {
  // Show success message and handle successful purchase
  // checkout.customer_email contains the customer's email
} else {
  // Handle failed/expired checkouts
}
\`\`\`

The checkout status can be "succeeded" (payment completed), "failed" (payment failed), "expired" (session expired), or "open" (still awaiting payment).

This implementation creates a complete checkout flow using Polar's infrastructure for payment processing and subscription management.`
    }
  },
  'customer-portal': {
    id: 'customer-portal',
    name: 'Customer Portal',
    description: 'Generate a customer self-service portal with account management and billing features',
    defaultConfig: {} as CustomerPortalConfig,
    generatePrompt: (config: CustomerPortalConfig, accessToken: string) => {
      return `Create a customer portal button that generates a secure customer portal session and redirects the customer to Polar's hosted customer portal.

**Customer Portal Session Creation:**

Use the customer ID from your authentication system, if known, or use a dummy customer ID for now. Here's how to implement it:

\`\`\`javascript
// Server action or API route to create customer portal session
async function createCustomerPortalSession(externalCustomerId) {
  try {
    const response = await fetch('https://api.polar.sh/v1/customer-sessions/', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ${accessToken}',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: externalCustomerId  // Use customer ID from authentication system or dummy ID
      })
    })

    if (!response.ok) {
      throw new Error('Customer not found')
    }

    const session = await response.json()

    // Redirect customer to Polar's hosted customer portal
    window.location.href = session.customer_portal_url

  } catch (error) {
    console.error('Failed to create customer portal session:', error)
    throw error
  }
}
\`\`\`

For more details, see: https://polar.sh/docs/features/customer-portal.md`
    }
  }
}

export default function ClientPage({ organization }: ClientPageProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('pricing-page')
  const [templateConfigs, setTemplateConfigs] = useState<Record<TemplateId, TemplateConfig>>({
    'pricing-page': TEMPLATES['pricing-page'].defaultConfig,
    'customer-portal': TEMPLATES['customer-portal'].defaultConfig
  })
  const [accessToken, setAccessToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [promptText, setPromptText] = useState('')

  const currentTemplate = TEMPLATES[selectedTemplateId]
  const currentConfig = templateConfigs[selectedTemplateId]

  const selectedProducts = selectedTemplateId === 'pricing-page' ? (currentConfig as PricingPageConfig).selectedProducts : []
  const { data: products } = useSelectedProducts(selectedProducts)
  const safeCopy = useSafeCopy(toast)
  const createToken = useCreateOrganizationAccessToken(organization.id)

  const generatedPrompt = useMemo(() => {
    return currentTemplate.generatePrompt(currentConfig, accessToken, products)
  }, [currentTemplate, currentConfig, accessToken, products])

  const handleCopyPrompt = useCallback(async () => {
    await safeCopy(promptText)
    toast({
      title: 'Copied to clipboard',
      description: 'The prompt has been copied to your clipboard.',
    })
  }, [promptText, safeCopy])

  const handleOpenExternal = useCallback(
    (platform: string) => {
      const encodedPrompt = encodeURIComponent(promptText)
      const urls = {
        lovable: `https://lovable.dev/?autosubmit=true#prompt=${encodedPrompt}`,
        v0: `https://v0.dev/?q=${encodedPrompt}`,
        bolt: `https://bolt.new/?prompt=${encodedPrompt}`,
      }

      const url = urls[platform as keyof typeof urls]
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [promptText],
  )

  const handleGenerateToken = useCallback(async () => {
    try {
      const { data: created } = await createToken.mutateAsync({
        comment: 'Vibe Coding API Token',
        expires_in: 'P365D', // 1 year
        scopes: ['checkouts:read', 'checkouts:write'],
      })
      if (created?.token) {
        setAccessToken(created.token)
        toast({
          title: 'Access Token Generated',
          description:
            'A new organization access token has been generated with checkout permissions.',
        })
      }
    } catch (error) {
      toast({
        title: 'Failed to Generate Token',
        description: 'Unable to generate access token. Please try again.',
        variant: 'error',
      })
    }
  }, [createToken])

  const toggleTokenVisibility = useCallback(() => {
    setShowToken(!showToken)
  }, [showToken])

  const updateTemplateConfig = useCallback((templateId: TemplateId, updates: Partial<TemplateConfig>) => {
    setTemplateConfigs(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], ...updates }
    }))
  }, [])

  const isDisabled = useMemo(() => {
    if (!accessToken.trim()) return true
    if (selectedTemplateId === 'pricing-page') {
      return !products || products.length === 0
    }
    return false
  }, [selectedTemplateId, products, accessToken])

  useEffect(() => {
    setPromptText(generatedPrompt)
  }, [generatedPrompt])

  return (
    <DashboardBody title="Prompt Generator">
      <div className="flex flex-col gap-y-8">
        {/* Template Selection */}
        <ShadowBoxOnMd className="flex flex-col gap-y-4 p-6">
          <h2 className="text-lg font-medium">Templates</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.values(TEMPLATES).map((template) => (
              <div
                key={template.id}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedTemplateId === template.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedTemplateId(template.id as TemplateId)}
              >
                <h3 className="font-medium">{template.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {template.description}
                </p>
              </div>
            ))}
          </div>
        </ShadowBoxOnMd>
        {/* Configuration and Authentication Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Configuration Section - 2/3 width */}
          <div className="lg:col-span-2">
            <ShadowBoxOnMd className="flex flex-col gap-y-6 p-6">
              <h2 className="text-lg font-medium">Configuration</h2>

              {/* Template-specific configuration */}
              {selectedTemplateId === 'pricing-page' && (
                <>
                  {/* Product Selection */}
                  <div className="flex flex-col gap-y-2">
                    <label className="text-sm font-medium">Select Products</label>
                    <ProductSelect
                      organization={organization}
                      value={(currentConfig as PricingPageConfig).selectedProducts}
                      onChange={(products) => updateTemplateConfig('pricing-page', { selectedProducts: products })}
                      emptyLabel="Select products to include"
                      className="w-full"
                    />
                    <p className="dark:text-polar-500 text-xs text-gray-500">
                      Choose which products to include in the generated pricing page.
                    </p>
                  </div>

                  {/* Success Page Path */}
                  <div className="flex flex-col gap-y-2">
                    <label className="text-sm font-medium">Success Page Path</label>
                    <Input
                      value={(currentConfig as PricingPageConfig).successPath}
                      onChange={(e) => updateTemplateConfig('pricing-page', { successPath: e.target.value })}
                      placeholder="/success"
                      className="w-full"
                    />
                    <p className="dark:text-polar-500 text-xs text-gray-500">
                      The path users will be redirected to after successful checkout.
                    </p>
                  </div>
                </>
              )}

              {selectedTemplateId === 'customer-portal' && (
                <div className="flex flex-col gap-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    No additional configuration needed for customer portal. The prompt will include instructions for using customer IDs from your authentication system.
                  </p>
                </div>
              )}
            </ShadowBoxOnMd>
          </div>

          {/* Authentication Section - 1/3 width */}
          <div className="lg:col-span-1">
            <ShadowBoxOnMd className="flex h-full flex-col gap-y-6 p-6">
              <h2 className="text-lg font-medium">Authentication</h2>

              {/* Organization Access Token */}
              <div className="flex flex-col gap-y-2">
                <label className="text-sm font-medium">
                  Organization Access Token
                </label>
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="polar_org_..."
                  className="w-full"
                  postSlot={
                    <button
                      type="button"
                      onClick={toggleTokenVisibility}
                      className="pointer-events-auto cursor-pointer"
                    >
                      {showToken ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  }
                />
                <Button
                  onClick={handleGenerateToken}
                  variant="secondary"
                  disabled={createToken.isPending}
                >
                  {createToken.isPending ? 'Generating...' : 'Generate New'}
                </Button>
              </div>
            </ShadowBoxOnMd>
          </div>
        </div>

        {/* Prompt Generation Section */}
        <ShadowBoxOnMd className="flex flex-col gap-y-4 p-6">
          <h2 className="text-lg font-medium">Generated Prompt</h2>
          <TextArea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            resizable={false}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Select products above to generate your prompt..."
          />
        </ShadowBoxOnMd>

        {/* Action Buttons */}
        <ShadowBoxOnMd className="flex flex-col gap-y-4 p-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleCopyPrompt}
              variant="default"
              disabled={isDisabled}
            >
              Copy Prompt
            </Button>

            <Button
              onClick={() => handleOpenExternal('lovable')}
              variant="secondary"
              disabled={isDisabled}
            >
              Open in Lovable
            </Button>

            <Button
              onClick={() => handleOpenExternal('v0')}
              variant="secondary"
              disabled={isDisabled}
            >
              Open in v0
            </Button>

            <Button
              onClick={() => handleOpenExternal('bolt')}
              variant="secondary"
              disabled={isDisabled}
            >
              Open in Bolt
            </Button>
          </div>

          <p className="dark:text-polar-500 text-xs text-gray-500">
            Copy the prompt to your clipboard or open it directly in your
            preferred vibe-coding platform.
          </p>
        </ShadowBoxOnMd>
      </div>
    </DashboardBody>
  )
}

'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import ProductSelect from '@/components/Products/ProductSelect'
import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
import { useSelectedProducts } from '@/hooks/queries/products'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { useCallback, useMemo, useState } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
}

export default function ClientPage({ organization }: ClientPageProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [successPath, setSuccessPath] = useState(
    '/success?checkout_id={CHECKOUT_ID}',
  )

  const { data: products } = useSelectedProducts(selectedProducts)
  const safeCopy = useSafeCopy(toast)

  const generatedPrompt = useMemo(() => {
    if (!products || products.length === 0) {
      return 'Select products above to generate a prompt for your vibe-coding platform.'
    }

    const productList = products
      .map((product) => {
        return `- **${product.name}**
  - ID: ${product.id}
  - Type: ${product.is_recurring ? 'Recurring/Subscription' : 'One-time purchase'}
  - Description: ${product.description || 'No description'}${
    product.prices?.length
      ? `
  - Pricing: ${product.prices
    .map((price) => {
      if (price.amount_type === 'free') return 'Free'
      if (price.amount_type === 'custom') return 'Pay what you want'
      if (price.amount_type === 'fixed' && 'price_amount' in price && price.price_amount) {
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
      if (price.amount_type === 'metered_unit' && 'unit_amount' in price && price.unit_amount) {
        let priceStr = `$${price.unit_amount / 100}${price.price_currency ? ` ${price.price_currency.toUpperCase()}` : ''}`
        if ('meter' in price && price.meter && price.meter.slug) {
          priceStr += ` per ${price.meter.slug}`
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

    return `# Create a Pricing Page with Polar Integration

You are tasked with creating a modern, responsive pricing page that integrates with Polar's payment infrastructure. Here are the requirements:

## Products to Display

${productList}

## Implementation Requirements

### 1. Create the Pricing Page
- Design a clean, modern pricing page displaying the products above
- Include product names, descriptions, and pricing information
- Add prominent call-to-action buttons for each product
- Make it responsive and visually appealing

### 2. Implement Checkout API Integration
Create an API handler that generates checkout sessions using Polar's API.
**API Documentation**: https://polar.sh/docs/api-reference/checkouts/create-session.md

**Authentication Setup:**
- Get your API key from Polar dashboard
- Use Bearer token authentication: \`Authorization: Bearer YOUR_API_KEY\`
- Required scope: \`checkouts:write\`

**API Implementation:**
\`\`\`javascript
// Example checkout creation
const response = await fetch('https://api.polar.sh/v1/checkouts/', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    products: [SELECTED_PRODUCT_IDS], // Array of product IDs from selection
    success_url: \`\${window.location.origin}${successPath}\`
    // Organization is automatically determined from your API key
  })
})

const checkout = await response.json()
// Redirect user to: checkout.url
\`\`\`

### 3. Create Success Page
Implement a success page at \`${successPath}\` that validates the checkout.
**API Documentation**: https://polar.sh/docs/api-reference/checkouts/get-session.md

**Success Page Implementation:**
\`\`\`javascript
// Get checkout_id from URL query parameters
const checkoutId = new URLSearchParams(window.location.search).get('checkout_id')

// Validate the checkout session
const response = await fetch(\`https://api.polar.sh/v1/checkouts/\${checkoutId}\`, {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})

const checkout = await response.json()

// Check if payment was successful
if (checkout.status === 'succeeded') {
  // Show success message and create user account
  // checkout.customer_email contains the customer's email
} else {
  // Handle failed/expired checkouts
}
\`\`\`

**Key Status Values:**
- \`"succeeded"\`: Payment completed successfully
- \`"failed"\`: Payment failed
- \`"expired"\`: Checkout session expired
- \`"open"\`: Still awaiting payment

This implementation will create a complete checkout flow using Polar's infrastructure for payment processing and subscription management.`
  }, [products, organization.id, successPath])

  const handleCopyPrompt = useCallback(async () => {
    await safeCopy(generatedPrompt)
    toast({
      title: 'Copied to clipboard',
      description: 'The prompt has been copied to your clipboard.',
    })
  }, [generatedPrompt, safeCopy])

  const handleOpenExternal = useCallback(
    (platform: string) => {
      const encodedPrompt = encodeURIComponent(generatedPrompt)
      const urls = {
        lovable: `https://lovable.dev/create?prompt=${encodedPrompt}`,
        v0: `https://v0.dev/chat?q=${encodedPrompt}`,
        bolt: `https://bolt.new/?prompt=${encodedPrompt}`,
        leap: `https://tryleap.ai/create?prompt=${encodedPrompt}`,
      }

      const url = urls[platform as keyof typeof urls]
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [generatedPrompt],
  )

  return (
    <DashboardBody title="Prompt Generator">
      <div className="flex flex-col gap-y-8">
        {/* Configuration Section */}
        <ShadowBoxOnMd className="flex flex-col gap-y-6 p-6">
          <h2 className="text-lg font-medium">Configuration</h2>

          {/* Product Selection */}
          <div className="flex flex-col gap-y-2">
            <label className="text-sm font-medium">Select Products</label>
            <ProductSelect
              organization={organization}
              value={selectedProducts}
              onChange={setSelectedProducts}
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
              value={successPath}
              onChange={(e) => setSuccessPath(e.target.value)}
              placeholder="/success?checkout_id={CHECKOUT_ID}"
              className="w-full"
            />
            <p className="dark:text-polar-500 text-xs text-gray-500">
              The path users will be redirected to after successful checkout.
            </p>
          </div>
        </ShadowBoxOnMd>

        {/* Prompt Generation Section */}
        <ShadowBoxOnMd className="flex flex-col gap-y-4 p-6">
          <h2 className="text-lg font-medium">Generated Prompt</h2>
          <TextArea
            value={generatedPrompt}
            readOnly
            resizable={false}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Select products above to generate your prompt..."
          />
        </ShadowBoxOnMd>

        {/* Action Buttons */}
        <ShadowBoxOnMd className="flex flex-col gap-y-4 p-6">
          <h2 className="text-lg font-medium">Actions</h2>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCopyPrompt} variant="default">
              Copy Prompt
            </Button>

            <Button
              onClick={() => handleOpenExternal('lovable')}
              variant="secondary"
              disabled={!products || products.length === 0}
            >
              Open in Lovable
            </Button>

            <Button
              onClick={() => handleOpenExternal('v0')}
              variant="secondary"
              disabled={!products || products.length === 0}
            >
              Open in v0
            </Button>

            <Button
              onClick={() => handleOpenExternal('bolt')}
              variant="secondary"
              disabled={!products || products.length === 0}
            >
              Open in Bolt
            </Button>

            <Button
              onClick={() => handleOpenExternal('leap')}
              variant="secondary"
              disabled={!products || products.length === 0}
            >
              Open in Leap
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

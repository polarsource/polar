import { SettingsOutlined } from '@mui/icons-material'
import { CheckoutLink } from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { twMerge } from 'tailwind-merge'
import ProductPriceLabel from '../Products/ProductPriceLabel'

const LinkList = ({
  links,
  current,
  onSelect,
}: {
  links: CheckoutLink[]
  current: string | undefined
  onSelect: (link: CheckoutLink, showForm: boolean) => void
}) => {
  return (
    <div>
      <div className="mb-4 flex flex-row">
        <h2 className="grow">Links</h2>
      </div>
      <List size="small">
        {links.map((link) => {
          const url = new URL(link.url)
          return (
            <ListItem
              size="small"
              className="justify-between gap-x-6 whitespace-nowrap px-4 py-3 text-sm"
              inactiveClassName="dark:text-polar-500 text-gray-500"
              selectedClassName="text-black dark:text-white"
              key={link.id}
              selected={current === link.id}
              onSelect={() => onSelect(link, false)}
            >
              <p
                className={twMerge(
                  'overflow-hidden text-ellipsis',
                  !link.label && 'italic',
                )}
              >
                {link.label || 'No label'}
              </p>
              <div className="flex grow flex-row items-center justify-end gap-x-6">
                {link.success_url && (
                  <Pill color="blue" className="truncate">
                    {url.host}
                  </Pill>
                )}
                {link.product_price && !link.product_price.is_archived && (
                  <ProductPriceLabel price={link.product_price} />
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(link, true)
                  }}
                >
                  <SettingsOutlined fontSize="inherit" />
                </Button>
              </div>
            </ListItem>
          )
        })}
      </List>
    </div>
  )
}

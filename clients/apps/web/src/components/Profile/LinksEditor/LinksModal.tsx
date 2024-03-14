import { CloseOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { useState } from 'react'
import { Link } from './LinksEditor'

export interface LinksModalProps {
  links: Link[]
  organization: Organization
  hideModal: () => void
  setLinks: (producer: (links: Link[]) => Link[]) => void
}

export const LinksModal = ({
  links,
  organization,
  hideModal,
  setLinks,
}: LinksModalProps) => {
  const [url, setUrl] = useState('')

  const addLink = (url: string) => {
    fetch(`/link/og?url=${url}`)
      .then((res) => (res && res.ok ? res.json() : undefined))
      .then((opengraph) => {
        setLinks((links) => [...links, { id: url, opengraph: opengraph, url }])
      })
  }

  const removeLink = (link: Link) => {
    setLinks((links) => links.filter((l) => l.id !== link.id))
  }

  return (
    <div className="relative flex flex-col gap-y-8 p-10">
      <div className="absolute right-6 top-6">
        <Button onClick={hideModal} size="icon" variant="ghost">
          <CloseOutlined
            className="dark:text-polar-200 text-gray-700"
            fontSize="small"
          />
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        <h3>Links</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Add links to resources that you want to surface on the profile.
          READMEs, blog posts, or websites are great examples.
        </p>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center gap-x-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
          <Button onClick={(e) => addLink(url)}>Add</Button>
        </div>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[420px] w-full flex-col gap-y-6 overflow-y-auto">
          {links.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <h3>Selected Links</h3>
              <div className="flex flex-col">
                {links.map((link) => (
                  <LinkRow key={link.id} link={link} onRemove={removeLink} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const LinkRow = ({
  link,
  onRemove,
}: {
  link: Link
  onRemove: (link: Link) => void
}) => {
  return (
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-4 rounded-lg px-4 py-3 text-gray-950 hover:bg-gray-100">
      <div className="flex w-full min-w-0 flex-shrink flex-row items-center gap-x-4">
        <img
          className="h-4 w-4"
          width={16}
          height={16}
          src={`https://${new URL(link.url).hostname}/favicon.ico`}
          alt={`Favicon for ${link}`}
        />
        <span className="truncate text-sm">{link.url}</span>
      </div>
      <div className="flex-shrink-0">
        <Button
          className="h-6 w-6"
          onClick={(e) => onRemove(link)}
          variant="secondary"
          size="icon"
        >
          <CloseOutlined fontSize="inherit" />
        </Button>
      </div>
    </div>
  )
}

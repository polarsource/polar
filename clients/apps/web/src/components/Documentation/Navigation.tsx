'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { CommandPaletteTrigger } from '@/components/CommandPalette/CommandPaletteTrigger'
import { useModal } from '@/components/Modal/useModal'
import {
  ApiOutlined,
  ArrowForward,
  ArticleOutlined,
  CloseOutlined,
  ConstructionOutlined,
  KeyboardArrowDown,
  KeyboardArrowUp,
  NorthEastOutlined,
  ShortTextOutlined,
  SupportOutlined,
  TerminalOutlined,
  FavoriteBorderOutlined,
  WebhookOutlined,
  AssuredWorkloadOutlined,
} from '@mui/icons-material'
import { Pill } from 'polarkit/components/ui/atoms'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { OpenAPIV3_1 } from 'openapi-types'
import { Separator } from 'polarkit/components/ui/separator'
import { PropsWithChildren, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { NavigationItem } from './NavigationItem'
import { SearchPalette } from './SearchPalette'
import {
  APISection,
  HttpMethod,
  getAPISections,
  isFeaturedEndpoint,
  isIssueFundingEndpoint,
  isOtherEndpoint,
} from './openapi'


export const NavigationSection = ({
  title,
  children,
  defaultOpened = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpened: boolean
}) => {
  return (
    <CollapsibleSection
      title={title}
      defaultOpened={defaultOpened}
      isSubMenu={false}
    >
      <div className="flex flex-col">{children}</div>
    </CollapsibleSection>
  )
}

export const NavigationHeadline = ({ children }: { children: React.ReactNode }) => {
  return (
    <h2 className="mb-4 font-medium text-black dark:text-white">{children}</h2>
  )
}

const APISections = () => {
  return (
    <div className="flex flex-col">
      <NavigationItem href="/docs/api">Introduction</NavigationItem>
      <NavigationItem href="/docs/api/authentication">
        Authentication
      </NavigationItem>
    </div>
  )
}

const TSIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg {...props} viewBox="0 0 128 128">
      <path fill="#fff" d="M22.67 47h99.67v73.67H22.67z"></path><path data-name="original" fill="#007acc" d="M1.5 63.91v62.5h125v-125H1.5zm100.73-5a15.56 15.56 0 017.82 4.5 20.58 20.58 0 013 4c0 .16-5.4 3.81-8.69 5.85-.12.08-.6-.44-1.13-1.23a7.09 7.09 0 00-5.87-3.53c-3.79-.26-6.23 1.73-6.21 5a4.58 4.58 0 00.54 2.34c.83 1.73 2.38 2.76 7.24 4.86 8.95 3.85 12.78 6.39 15.16 10 2.66 4 3.25 10.46 1.45 15.24-2 5.2-6.9 8.73-13.83 9.9a38.32 38.32 0 01-9.52-.1 23 23 0 01-12.72-6.63c-1.15-1.27-3.39-4.58-3.25-4.82a9.34 9.34 0 011.15-.73L82 101l3.59-2.08.75 1.11a16.78 16.78 0 004.74 4.54c4 2.1 9.46 1.81 12.16-.62a5.43 5.43 0 00.69-6.92c-1-1.39-3-2.56-8.59-5-6.45-2.78-9.23-4.5-11.77-7.24a16.48 16.48 0 01-3.43-6.25 25 25 0 01-.22-8c1.33-6.23 6-10.58 12.82-11.87a31.66 31.66 0 019.49.26zm-29.34 5.24v5.12H56.66v46.23H45.15V69.26H28.88v-5a49.19 49.19 0 01.12-5.17C29.08 59 39 59 51 59h21.83z"></path>
    </svg>
  )
}

const PYIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg {...props} viewBox="0 0 128 128">
      <linearGradient id="python-original-a" gradientUnits="userSpaceOnUse" x1="70.252" y1="1237.476" x2="170.659" y2="1151.089" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)"><stop offset="0" stopColor="#5A9FD4"></stop><stop offset="1" stopColor="#306998"></stop></linearGradient><linearGradient id="python-original-b" gradientUnits="userSpaceOnUse" x1="209.474" y1="1098.811" x2="173.62" y2="1149.537" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)"><stop offset="0" stopColor="#FFD43B"></stop><stop offset="1" stopColor="#FFE873"></stop></linearGradient><path fill="url(#python-original-a)" d="M63.391 1.988c-4.222.02-8.252.379-11.8 1.007-10.45 1.846-12.346 5.71-12.346 12.837v9.411h24.693v3.137H29.977c-7.176 0-13.46 4.313-15.426 12.521-2.268 9.405-2.368 15.275 0 25.096 1.755 7.311 5.947 12.519 13.124 12.519h8.491V67.234c0-8.151 7.051-15.34 15.426-15.34h24.665c6.866 0 12.346-5.654 12.346-12.548V15.833c0-6.693-5.646-11.72-12.346-12.837-4.244-.706-8.645-1.027-12.866-1.008zM50.037 9.557c2.55 0 4.634 2.117 4.634 4.721 0 2.593-2.083 4.69-4.634 4.69-2.56 0-4.633-2.097-4.633-4.69-.001-2.604 2.073-4.721 4.633-4.721z" transform="translate(0 10.26)"></path><path fill="url(#python-original-b)" d="M91.682 28.38v10.966c0 8.5-7.208 15.655-15.426 15.655H51.591c-6.756 0-12.346 5.783-12.346 12.549v23.515c0 6.691 5.818 10.628 12.346 12.547 7.816 2.297 15.312 2.713 24.665 0 6.216-1.801 12.346-5.423 12.346-12.547v-9.412H63.938v-3.138h37.012c7.176 0 9.852-5.005 12.348-12.519 2.578-7.735 2.467-15.174 0-25.096-1.774-7.145-5.161-12.521-12.348-12.521h-9.268zM77.809 87.927c2.561 0 4.634 2.097 4.634 4.692 0 2.602-2.074 4.719-4.634 4.719-2.55 0-4.633-2.117-4.633-4.719 0-2.595 2.083-4.692 4.633-4.692z" transform="translate(0 10.26)"></path><radialGradient id="python-original-c" cx="1825.678" cy="444.45" r="26.743" gradientTransform="matrix(0 -.24 -1.055 0 532.979 557.576)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#B8B8B8" stopOpacity=".498"></stop><stop offset="1" stopColor="#7F7F7F" stopOpacity="0"></stop></radialGradient><path opacity=".444" fill="url(#python-original-c)" d="M97.309 119.597c0 3.543-14.816 6.416-33.091 6.416-18.276 0-33.092-2.873-33.092-6.416 0-3.544 14.815-6.417 33.092-6.417 18.275 0 33.091 2.872 33.091 6.417z"></path>
    </svg>
  )
}

const PHPIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg {...props} viewBox="0 0 128 128">
      <path fill="url(#a)" d="M0 64c0 18.593 28.654 33.667 64 33.667 35.346 0 64-15.074 64-33.667 0-18.593-28.655-33.667-64-33.667C28.654 30.333 0 45.407 0 64Z"></path><path fill="#777bb3" d="M64 95.167c33.965 0 61.5-13.955 61.5-31.167 0-17.214-27.535-31.167-61.5-31.167S2.5 46.786 2.5 64c0 17.212 27.535 31.167 61.5 31.167Z"></path><path d="M34.772 67.864c2.793 0 4.877-.515 6.196-1.53 1.306-1.006 2.207-2.747 2.68-5.175.44-2.27.272-3.854-.5-4.71-.788-.874-2.493-1.317-5.067-1.317h-4.464l-2.473 12.732zM20.173 83.547a.694.694 0 0 1-.68-.828l6.557-33.738a.695.695 0 0 1 .68-.561h14.134c4.442 0 7.748 1.206 9.827 3.585 2.088 2.39 2.734 5.734 1.917 9.935-.333 1.711-.905 3.3-1.7 4.724a15.818 15.818 0 0 1-3.128 3.92c-1.531 1.432-3.264 2.472-5.147 3.083-1.852.604-4.232.91-7.07.91h-5.724l-1.634 8.408a.695.695 0 0 1-.682.562z"></path><path fill="#fff" d="M34.19 55.826h3.891c3.107 0 4.186.682 4.553 1.089.607.674.723 2.097.331 4.112-.439 2.257-1.253 3.858-2.42 4.756-1.194.92-3.138 1.386-5.773 1.386h-2.786l2.205-11.342zm6.674-8.1H26.731a1.39 1.39 0 0 0-1.364 1.123L18.81 82.588a1.39 1.39 0 0 0 1.363 1.653h7.35a1.39 1.39 0 0 0 1.363-1.124l1.525-7.846h5.151c2.912 0 5.364-.318 7.287-.944 1.977-.642 3.796-1.731 5.406-3.237a16.522 16.522 0 0 0 3.259-4.087c.831-1.487 1.429-3.147 1.775-4.931.86-4.423.161-7.964-2.076-10.524-2.216-2.537-5.698-3.823-10.349-3.823zM30.301 68.557h4.471c2.963 0 5.17-.557 6.62-1.675 1.451-1.116 2.428-2.98 2.938-5.591.485-2.508.264-4.277-.665-5.308-.931-1.03-2.791-1.546-5.584-1.546h-5.036l-2.743 14.12m10.563-19.445c4.252 0 7.353 1.117 9.303 3.348 1.95 2.232 2.536 5.347 1.76 9.346-.322 1.648-.863 3.154-1.625 4.518-.764 1.366-1.76 2.614-2.991 3.747-1.468 1.373-3.097 2.352-4.892 2.935-1.794.584-4.08.875-6.857.875h-6.296l-1.743 8.97h-7.35l6.558-33.739h14.133"></path><path d="M69.459 74.577a.694.694 0 0 1-.682-.827l2.9-14.928c.277-1.42.209-2.438-.19-2.87-.245-.263-.979-.704-3.15-.704h-5.256l-3.646 18.768a.695.695 0 0 1-.683.56h-7.29a.695.695 0 0 1-.683-.826l6.558-33.739a.695.695 0 0 1 .682-.561h7.29a.695.695 0 0 1 .683.826L64.41 48.42h5.653c4.307 0 7.227.758 8.928 2.321 1.733 1.593 2.275 4.14 1.608 7.573l-3.051 15.702a.695.695 0 0 1-.682.56h-7.407z"></path><path fill="#fff" d="M65.31 38.755h-7.291a1.39 1.39 0 0 0-1.364 1.124l-6.557 33.738a1.39 1.39 0 0 0 1.363 1.654h7.291a1.39 1.39 0 0 0 1.364-1.124l3.537-18.205h4.682c2.168 0 2.624.463 2.641.484.132.14.305.795.019 2.264l-2.9 14.927a1.39 1.39 0 0 0 1.364 1.654h7.408a1.39 1.39 0 0 0 1.363-1.124l3.051-15.7c.715-3.686.103-6.45-1.82-8.217-1.836-1.686-4.91-2.505-9.398-2.505h-4.81l1.421-7.315a1.39 1.39 0 0 0-1.364-1.655zm0 1.39-1.743 8.968h6.496c4.087 0 6.907.714 8.457 2.14 1.553 1.426 2.017 3.735 1.398 6.93l-3.052 15.699h-7.407l2.901-14.928c.33-1.698.208-2.856-.365-3.474-.573-.617-1.793-.926-3.658-.926h-5.829l-3.756 19.327H51.46l6.558-33.739h7.292z"></path><path d="M92.136 67.864c2.793 0 4.878-.515 6.198-1.53 1.304-1.006 2.206-2.747 2.679-5.175.44-2.27.273-3.854-.5-4.71-.788-.874-2.493-1.317-5.067-1.317h-4.463l-2.475 12.732zM77.54 83.547a.694.694 0 0 1-.682-.828l6.557-33.738a.695.695 0 0 1 .682-.561H98.23c4.442 0 7.748 1.206 9.826 3.585 2.089 2.39 2.734 5.734 1.917 9.935a15.878 15.878 0 0 1-1.699 4.724 15.838 15.838 0 0 1-3.128 3.92c-1.53 1.432-3.265 2.472-5.147 3.083-1.852.604-4.232.91-7.071.91h-5.723l-1.633 8.408a.695.695 0 0 1-.683.562z"></path><path fill="#fff" d="M91.555 55.826h3.891c3.107 0 4.186.682 4.552 1.089.61.674.724 2.097.333 4.112-.44 2.257-1.254 3.858-2.421 4.756-1.195.92-3.139 1.386-5.773 1.386h-2.786l2.204-11.342zm6.674-8.1H84.096a1.39 1.39 0 0 0-1.363 1.123l-6.558 33.739a1.39 1.39 0 0 0 1.364 1.653h7.35a1.39 1.39 0 0 0 1.363-1.124l1.525-7.846h5.15c2.911 0 5.364-.318 7.286-.944 1.978-.642 3.797-1.731 5.408-3.238a16.52 16.52 0 0 0 3.258-4.086c.832-1.487 1.428-3.147 1.775-4.931.86-4.423.162-7.964-2.076-10.524-2.216-2.537-5.697-3.823-10.35-3.823zM87.666 68.557h4.47c2.964 0 5.17-.557 6.622-1.675 1.45-1.116 2.428-2.98 2.936-5.591.487-2.508.266-4.277-.665-5.308-.93-1.03-2.791-1.546-5.583-1.546h-5.035Zm10.563-19.445c4.251 0 7.354 1.117 9.303 3.348 1.95 2.232 2.537 5.347 1.759 9.346-.32 1.648-.862 3.154-1.624 4.518-.763 1.366-1.76 2.614-2.992 3.747-1.467 1.373-3.097 2.352-4.892 2.935-1.793.584-4.078.875-6.856.875h-6.295l-1.745 8.97h-7.35l6.558-33.739h14.133"></path><defs><radialGradient id="a" cx="0" cy="0" r="1" gradientTransform="matrix(84.04136 0 0 84.04136 38.426 42.169)" gradientUnits="userSpaceOnUse"><stop stopColor="#AEB2D5"></stop><stop offset=".3" stopColor="#AEB2D5"></stop><stop offset=".75" stopColor="#484C89"></stop><stop offset="1" stopColor="#484C89"></stop></radialGradient></defs>
    </svg>
  )
}

const GOIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg {...props} viewBox="0 0 128 128">
      <g fill="#00acd7" fillRule="evenodd"><path d="M11.156 54.829c-.243 0-.303-.122-.182-.303l1.273-1.637c.12-.182.424-.303.666-.303H34.55c.243 0 .303.182.182.364l-1.03 1.576c-.121.181-.424.363-.606.363zM2.004 60.404c-.242 0-.303-.12-.182-.303l1.273-1.636c.121-.182.424-.303.667-.303h27.636c.242 0 .364.182.303.364l-.485 1.454c-.06.243-.303.364-.545.364zM16.67 65.98c-.242 0-.302-.182-.181-.364l.848-1.515c.122-.182.364-.363.607-.363h12.12c.243 0 .364.181.364.424l-.12 1.454c0 .243-.243.425-.425.425zM79.58 53.738c-3.819.97-6.425 1.697-10.182 2.666-.91.243-.97.303-1.758-.606-.909-1.03-1.576-1.697-2.848-2.303-3.819-1.878-7.516-1.333-10.97.91-4.121 2.666-6.242 6.605-6.182 11.514.06 4.849 3.394 8.849 8.182 9.516 4.121.545 7.576-.91 10.303-4 .545-.667 1.03-1.394 1.636-2.243H56.064c-1.272 0-1.575-.788-1.151-1.818.788-1.879 2.242-5.03 3.09-6.606.183-.364.607-.97 1.516-.97h22.06c-.12 1.637-.12 3.273-.363 4.91-.667 4.363-2.303 8.363-4.97 11.878-4.364 5.758-10.06 9.333-17.273 10.303-5.939.788-11.454-.364-16.302-4-4.485-3.394-7.03-7.879-7.697-13.454-.788-6.606 1.151-12.546 5.151-17.758 4.303-5.636 10-9.212 16.97-10.485 5.697-1.03 11.151-.363 16.06 2.97 3.212 2.121 5.515 5.03 7.03 8.545.364.546.122.849-.606 1.03z"></path><path d="M99.64 87.253c-5.515-.122-10.546-1.697-14.788-5.334-3.576-3.09-5.818-7.03-6.545-11.697-1.091-6.848.787-12.909 4.909-18.302 4.424-5.819 9.757-8.849 16.97-10.122 6.181-1.09 12-.484 17.272 3.091 4.788 3.273 7.757 7.697 8.545 13.515 1.03 8.182-1.333 14.849-6.97 20.546-4 4.06-8.909 6.606-14.545 7.757-1.636.303-3.273.364-4.848.546zm14.424-24.485c-.06-.788-.06-1.394-.182-2-1.09-6-6.606-9.394-12.363-8.06-5.637 1.272-9.273 4.848-10.606 10.545-1.091 4.727 1.212 9.515 5.575 11.454 3.334 1.455 6.667 1.273 9.879-.363 4.788-2.485 7.394-6.364 7.697-11.576z" fillRule="nonzero"></path></g>
    </svg>
  )
}

export const SDKNavigation = () => {
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col">
        <NavigationItem
          href="/docs/developers/sdk/typescript"
          icon={<TSIcon width={14} />}
        >
          TypeScript
        </NavigationItem>
        <NavigationItem
          href="/docs/developers/sdk/python"
          icon={<PYIcon width={14} />}
        >
          Python
        </NavigationItem>
        <NavigationItem
          href="#"
          icon={<PHPIcon width={14} />}
        >
          PHP
          <Pill className="text-xxs" color="gray">Soon</Pill>
        </NavigationItem>
        <NavigationItem
          href="#"
          icon={<GOIcon width={14} />}
        >
          Go
          <Pill className="text-xxs" color="gray">Soon</Pill>
        </NavigationItem>
      </div>
      <div>
        <NavigationHeadline>Tools</NavigationHeadline>
        <NavigationItem href="/docs/developers/sdk/polar-init">
          polar-init
        </NavigationItem>
        <NavigationItem href="/docs/developers/sdk/checkout-link">
          checkout-link
        </NavigationItem>
        <NavigationItem href="/docs/developers/sdk/github-actions">
          GitHub Actions
        </NavigationItem>
      </div>
    </div>
  )
}

const APIMethodPill = ({ method }: { method: HttpMethod }) => {
  return (
    <span
      className={twMerge(
        'dark:bg-polar-800 rounded-sm bg-gray-200/50 px-1.5 py-0 font-mono text-[10px] font-normal',
        method === HttpMethod.GET &&
          'bg-green-100 text-green-500 dark:bg-green-950/50',
        method === HttpMethod.POST &&
          'bg-blue-100 text-blue-500 dark:bg-blue-950/50',
        method === HttpMethod.DELETE &&
          'bg-red-100 text-red-500 dark:bg-red-950/50',
        (method === HttpMethod.PATCH || method === HttpMethod.PUT) &&
          'bg-orange-100 text-orange-500 dark:bg-orange-950/50',
      )}
    >
      {method.toUpperCase()}
    </span>
  )
}

const APIReferenceSections = ({
  openAPISchema,
  filter,
  title,
  activeOperationId,
}: {
  openAPISchema: OpenAPIV3_1.Document
  filter: (endpoint: OpenAPIV3_1.PathItemObject) => boolean
  title: string
  activeOperationId: string | undefined
}) => {
  const sections = getAPISections(openAPISchema, filter)
  const isOpenedSection = (section: APISection) =>
    section.endpoints.some((endpoint) => endpoint.id === activeOperationId)

  return (
    <div className="flex flex-col gap-y-6">
      <h3>{title}</h3>
      <div className="flex flex-col gap-y-5">
        {sections.map((section) => (
          <CollapsibleSection
            key={section.name}
            title={section.name}
            defaultOpened={isOpenedSection(section)}
            isSubMenu={true}
          >
            {section.endpoints.map((endpoint) => (
              <NavigationItem
                key={endpoint.id}
                className="m-0 bg-transparent p-0 text-sm dark:bg-transparent"
                href={`/docs/api${endpoint.path}${endpoint.path.endsWith('/') ? '' : '/'}${endpoint.method}`}
                active={() => endpoint.id === activeOperationId}
              >
                <div className="flex w-full flex-row items-center justify-between gap-x-4">
                  {endpoint.name}
                  <APIMethodPill method={endpoint.method} />
                </div>
              </NavigationItem>
            ))}
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}

const CollapsibleSection = ({
  title,
  children,
  defaultOpened,
  isSubMenu = true,
}: PropsWithChildren<{
  title: string
  defaultOpened?: boolean
  isSubMenu: boolean
}>) => {
  const [isOpen, setIsOpen] = useState(defaultOpened || false)

  let containerClasses =
    '-mx-3 px-3 py-2 text-sm transition-colors hover:text-blue-500 dark:hover:text-white'
  if (isSubMenu) {
    containerClasses = twMerge(
      '-mx-4 -my-2 flex flex-col gap-y-2  px-4 py-2 hover:bg-gray-100 group rounded-xl transition-colors duration-100 dark:border dark:border-transparent',
      isOpen
        ? 'bg-gray-50 shadow-sm dark:border-polar-700 dark:bg-transparent'
        : 'dark:hover:bg-polar-800',
    )
  }

  return (
    <div className={containerClasses}>
      <div
        className="flex cursor-pointer flex-row items-center justify-between"
        onClick={() => setIsOpen((open) => !open)}
      >
        <h3
          className={twMerge(
            'dark:text-polar-500 dark:group-hover:text-polar-50 text-sm capitalize text-gray-500 transition-colors group-hover:text-black',
            !isSubMenu && 'hover:text-blue-500 dark:hover:text-white',
            isSubMenu && isOpen && 'text-black dark:text-white',
          )}
        >
          {title}
        </h3>
        <span className="dark:text-polar-500 text-gray-500">
          <AnimatePresence mode="popLayout">
            {isOpen ? (
              <motion.div
                key={0}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <KeyboardArrowUp fontSize="small" />
              </motion.div>
            ) : (
              <motion.div
                key={1}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <KeyboardArrowDown fontSize="small" />
              </motion.div>
            )}
          </AnimatePresence>
        </span>
      </div>
      {isOpen && <div className="flex flex-col gap-y-4 py-2">{children}</div>}
    </div>
  )
}

export const MainNavigation = () => {
  return (
    <>
      <div>
        <NavigationHeadline>Introduction</NavigationHeadline>
        <NavigationItem href="/docs">Welcome</NavigationItem>
        <NavigationItem href="/docs/onboarding">Quick Start</NavigationItem>
        <NavigationItem href="/docs/fees">Fees</NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Offer Products &amp; Subscriptions</NavigationHeadline>
        <div className="flex flex-col">
          <NavigationItem href="/docs/products">Overview</NavigationItem>
          <NavigationItem href="/docs/products/create">
            Create Products & Tiers
          </NavigationItem>
          <NavigationSection title="Offer Benefits" defaultOpened={true}>
            <NavigationItem
              href="/docs/benefits"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Introduction
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/file-downloads"
              icon={<ArrowForward fontSize="inherit" />}
            >
              File Downloads
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/license-keys"
              icon={<ArrowForward fontSize="inherit" />}
            >
              License Keys
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/github-repositories"
              icon={<ArrowForward fontSize="inherit" />}
            >
              GitHub Repo(s) Access
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/discord"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Discord Invites
            </NavigationItem>
            <NavigationItem
              href="/docs/benefits/ads"
              icon={<ArrowForward fontSize="inherit" />}
            >
              Sponsorship Placement
            </NavigationItem>
          </NavigationSection>
        </div>
      </div>

      <div>
        <NavigationHeadline>Orders &amp; Subscribers</NavigationHeadline>
        <NavigationItem href="/docs/sales">Sales Dashboard</NavigationItem>
        <NavigationItem href="/docs/sales/orders">
          Transaction History
        </NavigationItem>
        <NavigationItem href="/docs/sales/subscriptions">
          Subscriptions
        </NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Finance &amp; Payouts</NavigationHeadline>
        <NavigationItem href="/docs/finance/balance">
          Your Balance
        </NavigationItem>
        <NavigationItem href="/docs/finance/accounts">
          Connect Payout Account
        </NavigationItem>
        <NavigationItem href="/docs/finance/payouts">Payouts</NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Merchant of Record</NavigationHeadline>
        <NavigationItem href="/docs/merchant-of-record/tax">
          Sales tax & EU VAT
        </NavigationItem>
        <NavigationItem href="/docs/merchant-of-record/compliance">
          Invoices & Tax Forms
        </NavigationItem>
      </div>

      <div>
        <NavigationHeadline>GitHub Support</NavigationHeadline>
        <NavigationItem href="/docs/github/install">
          Connect Organization(s)
        </NavigationItem>
        <NavigationItem href="/docs/github/funding-yaml">
          Official FUNDING.yaml link
        </NavigationItem>
        <NavigationItem href="/docs/github/embeds">
          README Embeds
        </NavigationItem>
      </div>

      <div>
        <NavigationHeadline>Get Funding</NavigationHeadline>
        <NavigationItem href="/docs/donations">Donations</NavigationItem>
        <NavigationSection
          title="Issue Funding & Rewards"
          defaultOpened={false}
        >
          <NavigationItem
            href="/docs/issue-funding"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Introduction
          </NavigationItem>
          <NavigationItem
            href="/docs/issue-funding/getting-started"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Setup
          </NavigationItem>
          <NavigationItem
            href="/docs/issue-funding/workflow"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Workflow
          </NavigationItem>
          <NavigationItem
            href="/docs/issue-funding/reward-contributors"
            icon={<ArrowForward fontSize="inherit" />}
          >
            Reward Contributors
          </NavigationItem>
        </NavigationSection>
      </div>

      <div>
        <NavigationHeadline>For Customers</NavigationHeadline>
        <NavigationItem href="/docs/customers/purchases">
          Buying via Polar
        </NavigationItem>
      </div>
    </>
  )
}

export const GuidesNavigation = () => {
  return (
    <div>
      <NavigationHeadline>Guides</NavigationHeadline>
      <NavigationItem href="/docs/developers/guides/nextjs">
        Integrate with Next.js
      </NavigationItem>
      <NavigationItem href="/docs/developers/guides/node">
        Integrate with Node.js & Express
      </NavigationItem>
      <NavigationItem href="/docs/developers/guides/laravel">
        Integrate with Laravel
      </NavigationItem>
      <NavigationItem href="/docs/developers/guides/checkout">
        Integrate Checkouts
      </NavigationItem>
      <NavigationItem href="/docs/developers/guides/figma">
        Figma Plugins with License Keys
      </NavigationItem>
      <NavigationItem
        href="/docs/api/webhooks"
        icon={<NorthEastOutlined fontSize="inherit" />}
      >
        Setting up Webhooks
      </NavigationItem>
    </div>
  )
}

export const SupportNavigation = () => {
  return (
    <div>
      <NavigationHeadline>FAQ</NavigationHeadline>
      <NavigationItem href="/docs/support/faq#pricing">
        Payments & Fees
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#issue-funding">
        Issue funding
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#reward-contributors">
        Reward contributors
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#payouts">Payouts</NavigationItem>
      <NavigationItem href="/docs/support/faq#supported-platforms-countries--currencies">
        Supported Countries & Currencies
      </NavigationItem>
      <NavigationItem href="/docs/support/faq#security">
        Security
      </NavigationItem>
    </div>
  )
}

export const APINavigation = ({
  openAPISchema,
  activeOperationId,
}: {
  openAPISchema: OpenAPIV3_1.Document
  activeOperationId: string | undefined
}) => {
  return (
    <>
      <APISections />
      <APIReferenceSections
        openAPISchema={openAPISchema}
        filter={isFeaturedEndpoint}
        title="Featured Endpoints"
        activeOperationId={activeOperationId}
      />
      <APIReferenceSections
        openAPISchema={openAPISchema}
        filter={isIssueFundingEndpoint}
        title="Issue Funding Endpoints"
        activeOperationId={activeOperationId}
      />
      <APIReferenceSections
        openAPISchema={openAPISchema}
        filter={isOtherEndpoint}
        title="Other Endpoints"
        activeOperationId={activeOperationId}
      />
    </>
  )
}

type ActiveSection = (
  'overview'
  | 'support'
  | 'guides'
  | 'sandbox'
  | 'api'
  | 'webhooks'
  | 'sdk'
  | 'open-source'
)

export const DocumentationPageSidebar = ({
  children,
  activeSection,
}: {
  children?: React.ReactNode
  activeSection: ActiveSection
}) => {
  const { isShown, show, hide, toggle } = useModal()

  return (
    <div className="flex w-full flex-shrink-0 flex-col gap-y-12 md:w-60">
      <div className="-mx-3 hidden flex-col gap-y-12 md:flex">
        <CommandPaletteTrigger
          className="dark:bg-polar-800 w-full bg-white"
          onClick={show}
        />
      </div>
      <div className="flex flex-col gap-y-4">
        <div>
          <h3>Polar</h3>
          <ul className="flex flex-col mt-2">
            <li>
              <NavigationItem
                icon={<ArticleOutlined fontSize="inherit" />}
                href="/docs"
                active={() => activeSection === 'overview'}
              >
                Get Started
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<SupportOutlined fontSize="inherit" />}
                href="/docs/support"
                active={() => activeSection === 'support'}
              >
                Help
              </NavigationItem>
            </li>
          </ul>
        </div>

        <div>
          <h3>Developers</h3>
          <ul className="flex flex-col mt-2">
            <li>
              <NavigationItem
                icon={<ConstructionOutlined fontSize="inherit" />}
                href="/docs/developers"
                active={() => activeSection === 'guides'}
              >
                Start Building
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<AssuredWorkloadOutlined fontSize="inherit" />}
                href="/docs/developers/sandbox"
                active={() => activeSection === 'sandbox'}
              >
                Sandbox
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<ApiOutlined fontSize="inherit" />}
                href="/docs/api"
                active={() => activeSection === 'api'}
              >
                API Reference
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<WebhookOutlined fontSize="inherit" />}
                href="/docs/developers/webhooks"
                active={() => activeSection === 'webhooks'}
              >
                Webhooks
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<TerminalOutlined fontSize="inherit" />}
                href="/docs/developers/sdk"
                active={() => activeSection === 'sdk'}
              >
                SDK
              </NavigationItem>
            </li>
            <li>
              <NavigationItem
                icon={<FavoriteBorderOutlined fontSize="inherit" />}
                href="/docs/developers/open-source"
                active={() => activeSection === 'open-source'}
              >
                Open Source
              </NavigationItem>
            </li>
          </ul>
        </div>
      </div>

      {children && (
        <>
          <Separator />
          <div className="flex flex-col gap-y-8">{children}</div>
        </>
      )}

      <SearchPalette isShown={isShown} toggle={toggle} hide={hide} />
    </div>
  )
}

export const MobileNav = ({
  children,
  activeSection,
}: {
  children: React.ReactNode
  activeSection: ActiveSection
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const header = (
    <div className="dark:bg-polar-900 dark:border-polar-700 fixed left-0 right-0 top-0 z-50 flex flex-row items-center justify-between border-b border-gray-200 bg-gray-50 p-4 md:hidden">
      <a href="/" className="flex flex-shrink-0 flex-row items-center gap-x-3">
        <LogoIcon className="h-10 w-10 text-blue-500 dark:text-blue-400" />
        <span className="font-medium">Documentation</span>
      </a>

      <div
        className="dark:text-polar-200 flex flex-row items-center justify-center text-gray-700"
        onClick={() => setMobileNavOpen((toggle) => !toggle)}
      >
        {mobileNavOpen ? <CloseOutlined /> : <ShortTextOutlined />}
      </div>
    </div>
  )

  return mobileNavOpen ? (
    <div className="flex h-full flex-col px-8 py-4">
      <div className="dark:bg-polar-900 relative flex flex-row items-center justify-between bg-gray-50">
        {header}
      </div>
      <div className="z-10 flex h-full flex-col pt-8">
        <DocumentationPageSidebar activeSection={activeSection}>
          {children}
        </DocumentationPageSidebar>
      </div>
    </div>
  ) : (
    header
  )
}

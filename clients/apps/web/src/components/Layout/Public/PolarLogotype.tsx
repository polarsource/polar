'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import LogoType from '@/components/Brand/logos/LogoType'

import { useOutsideClick } from '@/utils/useOutsideClick'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { ArrowDown, Clipboard } from 'lucide-react'
import Link from 'next/link'
import { MouseEventHandler, useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export const PolarLogotype = ({
  logoVariant = 'icon',
  size,
  className,
  logoClassName,
  href,
}: {
  logoVariant?: 'icon' | 'logotype'
  size?: number
  className?: string
  logoClassName?: string
  href?: string
}) => {
  const PolarLogotypeRef = useRef<HTMLDivElement>(null)

  const [PolarLogotypeOpen, setPolarLogotypeOpen] = useState(false)

  useOutsideClick([PolarLogotypeRef], () => setPolarLogotypeOpen(false))

  const handleTriggerClick: MouseEventHandler<HTMLElement> = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setPolarLogotypeOpen(true)
    },
    [],
  )

  const handleCopyLogoToClipboard = useCallback(() => {
    navigator.clipboard.writeText(
      logoVariant === 'icon' ? PolarIconSVGString : PolarLogoSVGString,
    )
    setPolarLogotypeOpen(false)
  }, [logoVariant])

  const LogoComponent =
    logoVariant === 'logotype' ? (
      <LogoType
        className={twMerge(
          '-ml-2 text-black md:ml-0 dark:text-white',
          logoClassName,
        )}
        width={size ?? 100}
      />
    ) : (
      <LogoIcon
        className={twMerge('text-black dark:text-white', logoClassName)}
        size={size ?? 42}
      />
    )

  return (
    <div className={twMerge('relative flex flex-row items-center', className)}>
      <DropdownMenu open={PolarLogotypeOpen}>
        <DropdownMenuTrigger
          className={href ? 'cursor-pointer' : ''}
          onContextMenu={handleTriggerClick}
        >
          {href ? (
            <Link href={href}>{LogoComponent}</Link>
          ) : (
            <div>{LogoComponent}</div>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent ref={PolarLogotypeRef} align="start">
          <DropdownMenuItem
            className="flex flex-row gap-x-3"
            onClick={handleCopyLogoToClipboard}
          >
            <Clipboard className="h-3 w-3" />
            <span>Copy Logo as SVG</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex flex-row gap-x-3"
            onClick={() => setPolarLogotypeOpen(false)}
          >
            <ArrowDown className="h-3 w-3" />
            <Link href="/assets/brand/polar_brand.zip">
              Download Branding Assets
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const PolarIconSVGString = `<svg width="310" height="310" viewBox="0 0 310 310" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M139.5 193.65L61.48 271.67L39.11 249.31L117.13 171.29H0.85C0.29 165.94 0 160.5 0 155C0 149.82 0.25 144.71 0.75 139.66H117.13L34.71 57.24C41.38 49.04 48.88 41.54 57.06 34.85L139.5 117.29V0.77C144.6 0.26 149.77 0 155 0C160.45 0 165.83 0.28 171.14 0.83V309.17C165.83 309.72 160.45 310 155 310C149.77 310 144.6 309.74 139.5 309.23ZM209.41 155.48C209.41 110.36 227.85 68.62 257.44 38.67C266.17 46.37 274.03 55.03 280.85 64.5C258.28 88.02 244.2 120.49 244.2 155.48C244.2 190.28 258.52 221.27 281.43 244.69C274.67 254.2 266.87 262.91 258.19 270.66C228.64 241.24 209.41 201.13 209.41 155.48Z" fill="white"/>
</svg>`

const PolarLogoSVGString = `<svg width="1095" height="384" viewBox="0 0 1095 384" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M414.68 78.2H505.56C527.96 78.2 545.88 83.64 559.32 94.52C572.97 105.19 579.8 121.93 579.8 144.76C579.8 167.59 572.97 184.44 559.32 195.32C545.88 205.99 527.96 211.32 505.56 211.32H443.48V307H414.68ZM507.48 185.72C521.77 185.72 532.33 182.41 539.16 175.8C546.2 168.97 549.72 158.63 549.72 144.76C549.72 130.89 546.2 120.65 539.16 114.04C532.33 107.21 521.77 103.8 507.48 103.8H443.48V185.72ZM668.41 311.8C651.99 311.8 637.69 308.17 625.53 300.92C613.59 293.67 604.41 283.53 598.01 270.52C591.61 257.29 588.41 242.25 588.41 225.4C588.41 208.55 591.61 193.61 598.01 180.6C604.41 167.37 613.59 157.13 625.53 149.88C637.69 142.63 651.99 139 668.41 139C684.63 139 698.71 142.63 710.65 149.88C722.81 157.13 732.09 167.37 738.49 180.6C744.89 193.61 748.09 208.55 748.09 225.4C748.09 242.25 744.89 257.29 738.49 270.52C732.09 283.53 722.81 293.67 710.65 300.92C698.71 308.17 684.63 311.8 668.41 311.8ZM668.41 289.4C680.15 289.4 689.96 286.63 697.85 281.08C705.75 275.32 711.61 267.64 715.45 258.04C719.29 248.23 721.21 237.35 721.21 225.4C721.21 213.45 719.29 202.68 715.45 193.08C711.61 183.27 705.75 175.59 697.85 170.04C689.96 164.28 680.15 161.4 668.41 161.4C656.68 161.4 646.76 164.28 638.65 170.04C630.76 175.59 624.89 183.27 621.05 193.08C617.21 202.68 615.29 213.45 615.29 225.4C615.29 237.35 617.21 248.23 621.05 258.04C624.89 267.64 630.76 275.32 638.65 281.08C646.76 286.63 656.68 289.4 668.41 289.4ZM776.12 78.2H801.72V307H776.12ZM883.42 311.48C866.99 311.48 853.87 307.21 844.06 298.68C834.46 290.15 829.66 278.95 829.66 265.08C829.66 253.13 832.43 243.53 837.98 236.28C843.52 229.03 851.2 223.48 861.02 219.64C870.83 215.8 883.63 212.49 899.42 209.72C903.04 209.08 906.56 208.44 909.98 207.8C917.23 206.31 922.99 204.71 927.26 203C931.52 201.29 934.72 199.05 936.86 196.28C938.99 193.51 940.06 189.88 940.06 185.4C940.06 178.15 937.5 172.39 932.38 168.12C927.26 163.64 918.51 161.4 906.14 161.4C895.9 161.4 887.79 162.47 881.82 164.6C876.06 166.73 871.9 170.25 869.34 175.16C866.78 179.85 865.18 186.25 864.54 194.36H837.66C838.51 177.51 844.59 164.07 855.9 154.04C867.2 144.01 884.27 139 907.1 139C924.16 139 938.03 143.16 948.7 151.48C959.58 159.8 965.02 173.24 965.02 191.8V270.2C965.02 276.81 965.66 281.72 966.94 284.92C968.22 287.91 970.35 289.4 973.34 289.4C974.62 289.19 975.9 289.08 977.18 289.08V307C972.48 308.07 968.32 308.6 964.7 308.6C959.79 308.6 955.63 307.85 952.22 306.36C948.8 304.87 946.03 302.31 943.9 298.68C941.98 294.84 940.8 289.61 940.38 283H939.74C934.19 292.17 926.72 299.21 917.34 304.12C907.95 309.03 896.64 311.48 883.42 311.48ZM885.98 289.08C896.43 289.08 905.71 287.48 913.82 284.28C922.14 281.08 928.54 276.07 933.02 269.24C937.71 262.41 940.06 253.99 940.06 243.96V218.04C937.92 220.39 933.44 222.63 926.62 224.76C920 226.89 911.68 228.92 901.66 230.84C890.56 232.97 881.82 235.43 875.42 238.2C869.02 240.97 864.22 244.39 861.02 248.44C858.03 252.49 856.54 257.61 856.54 263.8C856.54 272.12 858.88 278.41 863.58 282.68C868.27 286.95 875.74 289.08 885.98 289.08ZM1011.91 176.12H1031.11C1035.81 164.39 1041.67 155.32 1048.71 148.92C1055.97 142.52 1065.14 139.32 1076.23 139.32C1081.78 139.32 1086.79 139.64 1091.27 140.28V165.88C1087.43 165.24 1083.91 164.92 1080.71 164.92C1070.9 164.92 1062.15 167.37 1054.47 172.28C1046.79 176.97 1040.82 183.48 1036.55 191.8C1032.5 200.12 1030.47 209.51 1030.47 219.96ZM1004.87 143.8H1030.47V307H1004.87Z" fill="white"/>
<path d="M139.5 230.65L61.48 308.67L39.11 286.31L117.13 208.29H0.85C0.29 202.94 0 197.5 0 192C0 186.82 0.25 181.71 0.75 176.66H117.13L34.71 94.24C41.38 86.04 48.88 78.54 57.06 71.85L139.5 154.29V37.77C144.6 37.26 149.77 37 155 37C160.45 37 165.83 37.28 171.14 37.83V346.17C165.83 346.72 160.45 347 155 347C149.77 347 144.6 346.74 139.5 346.23ZM209.41 192.48C209.41 147.36 227.85 105.62 257.44 75.67C266.17 83.37 274.03 92.03 280.85 101.5C258.28 125.02 244.2 157.49 244.2 192.48C244.2 227.28 258.52 258.27 281.43 281.69C274.67 291.2 266.87 299.91 258.19 307.66C228.64 278.24 209.41 238.13 209.41 192.48Z" fill="white"/>
</svg>
`

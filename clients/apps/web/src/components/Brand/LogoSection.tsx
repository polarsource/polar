'use client'

import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined'
import { useTheme } from 'next-themes'
import React, { useCallback, useState } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { Headline } from '../Orbit'
import { SectionLayout } from './SectionLayout'
import { VectorEditor } from './Vector'

const LOGO_ICON_SVG = `<svg width="29" height="29" viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fillRule="evenodd" clipRule="evenodd" d="M9.07727 23.0572C13.8782 26.307 20.4046 25.0496 23.6545 20.2487C26.9043 15.4478 25.6469 8.92133 20.846 5.67149C16.0451 2.42165 9.51862 3.67905 6.26878 8.47998C3.01894 13.2809 4.27634 19.8073 9.07727 23.0572ZM10.4703 23.1428C14.862 25.3897 20.433 23.2807 22.9135 18.4322C25.394 13.5838 23.8447 7.83194 19.4531 5.58511C15.0614 3.33829 9.49042 5.4473 7.00991 10.2957C4.52939 15.1442 6.07867 20.896 10.4703 23.1428Z" fill="currentColor"/>
  <path fillRule="evenodd" clipRule="evenodd" d="M11.7222 24.2898C15.6865 25.58 20.35 22.1715 22.1385 16.6765C23.927 11.1815 22.1632 5.68099 18.1989 4.39071C14.2346 3.10043 9.5711 6.509 7.78261 12.004C5.99412 17.4989 7.75793 22.9995 11.7222 24.2898ZM12.9347 23.872C16.2897 24.5876 19.9174 20.9108 21.0374 15.6596C22.1574 10.4084 20.3457 5.57134 16.9907 4.85575C13.6357 4.14016 10.008 7.817 8.88797 13.0682C7.76793 18.3194 9.57971 23.1564 12.9347 23.872Z" fill="currentColor"/>
  <path fillRule="evenodd" clipRule="evenodd" d="M13.8537 24.7382C16.5062 25.0215 19.1534 20.5972 19.7664 14.8563C20.3794 9.1155 18.7261 4.23202 16.0736 3.94879C13.4211 3.66556 10.7739 8.08983 10.1609 13.8307C9.54788 19.5715 11.2012 24.455 13.8537 24.7382ZM15.0953 22.9906C17.015 22.9603 18.5101 19.0742 18.4349 14.3108C18.3596 9.54747 16.7424 5.71058 14.8228 5.7409C12.9032 5.77123 11.408 9.6573 11.4833 14.4207C11.5585 19.184 13.1757 23.0209 15.0953 22.9906Z" fill="currentColor"/>
</svg>`

function ClearSpaceGrid() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const grid = isDark ? '#333' : '#aaa'

  return (
    <svg
      width="536"
      height="536"
      viewBox="0 0 536 536"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_61_129)">
        <circle cx="70" cy="268" r="69.5" stroke={grid} />
        <circle cx="268" cy="466" r="69.5" stroke={grid} />
        <circle cx="268" cy="70" r="69.5" stroke={grid} />
        <circle cx="466" cy="268" r="69.5" stroke={grid} />
        <mask
          id="mask0_61_129"
          maskUnits="userSpaceOnUse"
          x="140"
          y="140"
          width="256"
          height="256"
        >
          <path d="M396 140H140V396H396V140Z" fill="white" />
        </mask>
        <g mask="url(#mask0_61_129)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M196.686 374.035C255.094 413.573 334.496 398.275 374.033 339.867C413.573 281.458 398.275 202.056 339.866 162.518C281.457 122.98 202.055 138.278 162.517 196.687C122.979 255.095 138.277 334.498 196.686 374.035ZM180.922 239.558C166.315 284.438 171.185 329.349 190.556 358.772C155.395 325.481 146.209 268.262 171.525 218.778C187.714 187.135 214.723 165.083 244.533 155.657C217.304 171.326 193.38 201.282 180.922 239.558ZM289.629 381.61C320.375 372.624 348.393 350.249 365.011 317.768C390.113 268.704 381.295 212.036 346.871 178.628C365.468 208.064 369.95 252.249 355.578 296.405C342.765 335.773 317.822 366.337 289.629 381.61ZM296.695 367.182C317.446 349.423 334.574 319.715 342.185 284.034C354.215 227.631 338.444 175.155 306.496 157.644C323.441 180.443 332.019 224.728 326.73 274.257C322.686 312.138 311.361 345.306 296.695 367.182ZM194.372 252.507C182.253 309.327 198.348 362.161 230.772 379.279C213.383 356.754 204.509 311.959 209.867 261.78C213.845 224.526 224.864 191.829 239.179 169.949C218.735 187.772 201.899 217.217 194.372 252.507ZM310.525 267.625C311.441 325.577 293.25 372.856 269.896 373.224C246.541 373.593 226.867 326.913 225.951 268.962C225.036 211.009 243.226 163.731 266.581 163.362C289.935 162.993 309.61 209.673 310.525 267.625Z"
            fill="currentColor"
          />
        </g>
      </g>
      <rect x="0.5" y="0.5" width="535" height="535" stroke={grid} />
      <path d="M140 2V535.5M395.5 2V535.5" stroke={grid} />
      <path d="M1 396.5L534.5 396.5M0.999989 141L534.5 141" stroke={grid} />
      <defs>
        <clipPath id="clip0_61_129">
          <rect width="536" height="536" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
  )
}

function WordmarkClearSpaceGrid() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const grid = isDark ? '#2a2a2a' : '#aaa'

  // Logo at 50% scale: 510×150. Canvas adds 100px clear space on all sides → -100,-100 to 610,250
  // Circles r=50 fill each 100px margin, guide lines sit at the scaled logo bounds.
  return (
    <svg
      width="100%"
      viewBox="-100 -100 710 350"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Clear space circles — r=50 fills each 100px margin */}
      <circle cx="-50" cy="75" r="50" stroke={grid} />
      <circle cx="560" cy="75" r="50" stroke={grid} />
      <circle cx="255" cy="-50" r="50" stroke={grid} />
      <circle cx="255" cy="200" r="50" stroke={grid} />

      {/* Wordmark paths scaled to 50% (510×150) */}
      <g transform="scale(0.5)">
        <path
          d="M397.382 244.212V53.4181H473.428C483.421 53.4181 492.508 55.962 500.684 61.0499C508.861 65.956 515.311 72.77 520.036 81.492C524.942 90.214 527.395 99.9354 527.395 110.656C527.395 121.74 524.942 131.735 520.036 140.638C515.311 149.542 508.861 156.629 500.684 161.898C492.508 167.167 483.421 169.802 473.428 169.802H421.096V244.212H397.382ZM421.096 146.634H473.972C479.424 146.634 484.33 145.09 488.692 142.001C493.052 138.73 496.505 134.369 499.049 128.918C501.593 123.467 502.865 117.379 502.865 110.656C502.865 104.115 501.593 98.3 499.049 93.2122C496.505 88.1244 493.052 84.0359 488.692 80.9468C484.33 77.8578 479.424 76.3133 473.972 76.3133H421.096V146.634Z"
          fill="currentColor"
        />
        <path
          d="M615.217 246.937C601.226 246.937 588.688 243.757 577.604 237.397C566.701 230.856 558.071 222.043 551.711 210.959C545.351 199.693 542.171 186.883 542.171 172.528C542.171 158.173 545.351 145.453 551.711 134.369C558.071 123.284 566.701 114.563 577.604 108.203C588.688 101.843 601.226 98.6634 615.217 98.6634C629.209 98.6634 641.656 101.843 652.559 108.203C663.643 114.563 672.274 123.284 678.452 134.369C684.811 145.453 687.991 158.173 687.991 172.528C687.991 186.883 684.811 199.693 678.452 210.959C672.274 222.043 663.643 230.856 652.559 237.397C641.656 243.757 629.209 246.937 615.217 246.937ZM615.217 225.677C624.848 225.677 633.389 223.406 640.838 218.863C648.288 214.139 654.103 207.779 658.283 199.784C662.644 191.789 664.733 182.704 664.552 172.528C664.733 162.352 662.644 153.358 658.283 145.544C654.103 137.549 648.288 131.28 640.838 126.737C633.389 122.195 624.848 119.923 615.217 119.923C605.587 119.923 596.956 122.195 589.324 126.737C581.874 131.28 576.059 137.549 571.88 145.544C567.701 153.539 565.612 162.534 565.612 172.528C565.612 182.704 567.701 191.789 571.88 199.784C576.059 207.779 581.874 214.139 589.324 218.863C596.956 223.406 605.587 225.677 615.217 225.677Z"
          fill="currentColor"
        />
        <path
          d="M712.897 244.212V42.5156H735.792V244.212H712.897Z"
          fill="currentColor"
        />
        <path
          d="M826.119 246.937C813.945 246.937 802.86 243.757 792.866 237.397C783.054 230.856 775.241 221.952 769.426 210.686C763.612 199.421 760.704 186.701 760.704 172.528C760.704 158.173 763.702 145.453 769.698 134.369C775.695 123.284 783.69 114.563 793.684 108.203C803.86 101.843 815.217 98.6634 827.754 98.6634C835.204 98.6634 842.019 99.7537 848.196 101.934C854.556 104.115 860.189 107.204 865.096 111.201C870.001 115.017 874.09 119.56 877.361 124.829C880.631 129.917 882.811 135.368 883.902 141.184L877.906 138.457L878.178 101.662H901.073V244.212H878.178V209.597L883.902 206.598C882.63 211.867 880.177 216.955 876.542 221.862C873.09 226.768 868.729 231.128 863.46 234.944C858.372 238.579 852.648 241.486 846.288 243.666C839.928 245.846 833.206 246.937 826.119 246.937ZM831.57 225.404C840.838 225.404 849.014 223.134 856.1 218.591C863.188 214.048 868.821 207.87 873 200.057C877.179 192.061 879.269 182.885 879.269 172.528C879.269 162.352 877.179 153.358 873 145.544C869.002 137.731 863.369 131.552 856.1 127.01C849.014 122.467 840.838 120.196 831.57 120.196C822.303 120.196 814.126 122.467 807.04 127.01C799.953 131.552 794.32 137.731 790.14 145.544C786.143 153.358 784.145 162.352 784.145 172.528C784.145 182.704 786.143 191.789 790.14 199.784C794.32 207.779 799.953 214.048 807.04 218.591C814.126 223.134 822.303 225.404 831.57 225.404Z"
          fill="currentColor"
        />
        <path
          d="M930.49 244.212V101.662H953.386L953.931 141.728L951.478 134.914C953.476 128.191 956.747 122.104 961.29 116.652C965.832 111.201 971.193 106.84 977.371 103.569C983.73 100.299 990.454 98.6634 997.54 98.6634C1000.63 98.6634 1003.54 98.936 1006.26 99.4811C1009.17 99.8446 1011.53 100.39 1013.35 101.116L1007.08 126.464C1004.72 125.375 1002.27 124.556 999.721 124.012C997.177 123.467 994.814 123.194 992.634 123.194C986.82 123.194 981.46 124.284 976.553 126.464C971.829 128.645 967.74 131.644 964.288 135.46C961.017 139.093 958.383 143.364 956.383 148.27C954.567 153.176 953.658 158.446 953.658 164.078V244.212H930.49Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M64.8636 269.177C130.906 313.882 220.684 296.585 265.388 230.543C310.094 164.501 292.798 74.723 226.756 30.0179C160.714 -14.6872 70.935 2.60972 26.2299 68.6516C-18.4753 134.693 -1.17834 224.472 64.8636 269.177ZM84.0172 270.357C144.43 301.264 221.064 272.251 255.187 205.557C289.309 138.861 267.997 59.7378 207.584 28.8301C147.173 -2.0774 70.5375 26.9345 36.4152 93.63C2.29299 160.325 23.6051 239.448 84.0172 270.357Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M101.233 286.13C155.766 303.879 219.918 256.991 244.522 181.401C269.124 105.812 244.86 30.146 190.327 12.3967C135.794 -5.35246 71.6428 41.5362 47.04 117.126C22.4374 192.715 46.7007 268.381 101.233 286.13ZM117.915 280.385C164.066 290.229 213.97 239.649 229.378 167.414C244.784 95.1779 219.862 28.6392 173.71 18.7955C127.559 8.95174 77.6556 59.5307 62.2482 131.767C46.841 204.002 71.7639 270.541 117.915 280.385Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M130.567 292.297C167.056 296.192 203.471 235.332 211.903 156.36C220.336 77.3886 197.592 10.2109 161.104 6.3148C124.616 2.41866 88.2006 63.2795 79.7681 142.251C71.3357 221.222 94.0792 288.401 130.567 292.297ZM147.642 268.26C174.048 267.843 194.616 214.386 193.58 148.861C192.546 83.3351 170.299 30.5544 143.893 30.9716C117.486 31.3889 96.9186 84.8459 97.9538 150.372C98.9891 215.897 121.235 268.677 147.642 268.26Z"
          fill="currentColor"
        />
      </g>

      {/* Guide lines at scaled logo bounds (510×150) */}
      <rect x="-99.5" y="-99.5" width="709" height="349" stroke={grid} />
      <path d="M0 -100V250M510 -100V250" stroke={grid} />
      <path d="M-100 0H610M-100 150H610" stroke={grid} />
    </svg>
  )
}

function DownloadButton() {
  return (
    <a
      href="/assets/brand/polar_brand.zip"
      download
      className="flex w-fit cursor-none flex-row items-center gap-x-3 border-b border-black pb-0.5 text-2xl dark:border-white"
    >
      <ArrowDownwardOutlined fontSize="inherit" />
      <span>Brand Assets</span>
    </a>
  )
}

function DontCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="dark:bg-polar-900 relative flex aspect-square items-center justify-center overflow-hidden bg-neutral-100">
        {children}
        <div className="pointer-events-none absolute right-2 bottom-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <line
              x1="1"
              y1="1"
              x2="11"
              y2="11"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="11"
              y1="1"
              x2="1"
              y2="11"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <span className="dark:text-polar-500 text-sm text-neutral-500">
        {label}
      </span>
    </div>
  )
}

export function LogoSection() {
  const [svgData, setSvgData] = useState(LOGO_ICON_SVG)

  const hideBrandCursor = useCallback(() => {
    const el = document.querySelector<HTMLElement>('[data-brand-cursor]')
    if (el) el.style.opacity = '0'
  }, [])

  const showBrandCursor = useCallback(() => {
    const el = document.querySelector<HTMLElement>('[data-brand-cursor]')
    if (el) el.style.opacity = '1'
  }, [])

  return (
    <SectionLayout label="Logo">
      <div className="flex flex-col gap-16 md:gap-48">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="dark:bg-polar-900 flex aspect-square items-center justify-center bg-neutral-100">
              <PolarLogotype
                logoVariant="logotype"
                logoClassName="dark:text-white"
                size={360}
              />
            </div>
            <div className="dark:bg-polar-900 flex aspect-square items-center justify-center bg-neutral-100">
              <PolarLogotype
                logoVariant="icon"
                logoClassName="dark:text-white"
                size={220}
              />
            </div>
            <div
              className="dark:bg-polar-900 flex aspect-square cursor-auto items-center justify-center bg-neutral-100"
              onMouseEnter={hideBrandCursor}
              onMouseLeave={showBrandCursor}
            >
              <VectorEditor
                svg={svgData}
                width={300}
                height={300}
                onChange={setSvgData}
              />
            </div>
          </div>
        </div>

        {/* ── The Polar Wordmark ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-16">
          {/* Title */}
          <div className="flex flex-col gap-6">
            <Headline as="h2" text={['The Polar', 'Wordmark']} />
            <DownloadButton />
          </div>

          {/* Body + clear space + Don'ts */}
          <div className="flex flex-col gap-20">
            <div className="flex flex-col gap-6 text-lg leading-relaxed md:text-xl">
              <p>
                The Polar wordmark joins the globe mark with the logotype,
                forming the complete brand signature. Use it wherever both the
                symbol and the name need to be present — marketing materials,
                landing pages, and any context where Polar is being introduced.
              </p>
              <p>
                The wordmark maintains a fixed spatial relationship between the
                globe and the type. Never separate, rearrange, or independently
                resize either element.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="dark:bg-polar-900 flex items-center justify-center bg-neutral-100 p-8">
                <WordmarkClearSpaceGrid />
              </div>
              <p className="dark:text-polar-500 text-lg leading-relaxed text-neutral-500">
                Always surround the wordmark with clear space equal to the
                height of the globe mark. Keep this zone free of other
                logotypes, body copy, illustrations, and decorative elements. On
                busy backgrounds, increase the margin further to preserve
                legibility.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <DontCard label="Don't stretch or distort">
                <div style={{ transform: 'scaleY(1.6)' }}>
                  <PolarLogotype
                    logoVariant="logotype"
                    logoClassName="dark:text-white"
                    size={150}
                  />
                </div>
              </DontCard>

              <DontCard label="Don't rotate">
                <div style={{ transform: 'rotate(45deg)' }}>
                  <PolarLogotype
                    logoVariant="logotype"
                    logoClassName="dark:text-white"
                    size={150}
                  />
                </div>
              </DontCard>

              <DontCard label="Don't use low-contrast colour">
                <PolarLogotype
                  logoVariant="logotype"
                  logoClassName="text-neutral-200 dark:text-neutral-800"
                  size={150}
                />
              </DontCard>

              <DontCard label="Don't recolour outside brand palette">
                <PolarLogotype
                  logoVariant="logotype"
                  logoClassName="text-emerald-500 dark:text-emerald-500"
                  size={150}
                />
              </DontCard>

              <DontCard label="Don't use below 100px wide">
                <PolarLogotype
                  logoVariant="logotype"
                  logoClassName="dark:text-white"
                  size={80}
                />
              </DontCard>
            </div>
          </div>

          {/* Wordmark on black — 3:2 ratio */}
          <div
            className="dark:bg-polar-900 flex items-center justify-center bg-neutral-100"
            style={{ aspectRatio: '3 / 2' }}
          >
            <PolarLogotype logoVariant="logotype" size={300} />
          </div>
        </div>

        {/* ── The Polar Globe ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-16">
          {/* Title */}
          <div className="flex flex-col gap-6">
            <Headline as="h2" text="The Polar Globe" />
            <DownloadButton />
          </div>

          {/* Body + clear space + Don'ts */}
          <div className="flex flex-col gap-20">
            <div className="flex flex-col gap-6 text-lg leading-relaxed md:text-xl">
              <p>
                A polar reference is a point of orientation — something constant
                in a shifting landscape. For AI companies, billing is that
                reference point. It&apos;s where experimentation meets
                economics, where intelligence becomes revenue.
              </p>
              <p>
                The globe embodies that role: steady at the center, expansive at
                the edges. As AI companies scale across borders and models
                evolve in real time, Polar provides the infrastructure that
                keeps value aligned with usage — globally, reliably, and without
                friction.
              </p>
              <p>Not just billing. A fixed point for a moving world.</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="dark:bg-polar-900 flex items-center justify-center bg-neutral-100 p-8">
                <ClearSpaceGrid />
              </div>
              <p className="dark:text-polar-500 text-lg leading-relaxed text-neutral-500">
                Maintain clear space equal to the diameter of the globe on all
                sides. Nothing — text, imagery, or other marks — should enter
                this zone. On tight layouts, reduce the logo size before
                reducing its breathing room.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <DontCard label="Don't stretch or distort">
                <div style={{ transform: 'scaleX(1.6)' }}>
                  <PolarLogotype
                    logoVariant="icon"
                    logoClassName="dark:text-white"
                    size={130}
                  />
                </div>
              </DontCard>

              <DontCard label="Don't rotate">
                <div style={{ transform: 'rotate(45deg)' }}>
                  <PolarLogotype
                    logoVariant="icon"
                    logoClassName="dark:text-white"
                    size={130}
                  />
                </div>
              </DontCard>

              <DontCard label="Don't use low-contrast colour">
                <PolarLogotype
                  logoVariant="icon"
                  logoClassName="text-neutral-200 dark:text-neutral-800"
                  size={130}
                />
              </DontCard>

              <DontCard label="Don't recolour outside brand palette">
                <PolarLogotype
                  logoVariant="icon"
                  logoClassName="text-emerald-500 dark:text-emerald-500"
                  size={130}
                />
              </DontCard>
            </div>
          </div>

          {/* Logo on black — 2:3 ratio */}
          <div
            className="dark:bg-polar-900 flex items-center justify-center bg-neutral-100"
            style={{ aspectRatio: '2 / 3' }}
          >
            <PolarLogotype logoVariant="icon" size={200} />
          </div>
        </div>
      </div>
    </SectionLayout>
  )
}

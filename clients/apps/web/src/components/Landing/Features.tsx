'use client'

import { motion } from 'framer-motion'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const IX = 0.866 // cos(30°)
const IY = 0.5 // sin(30°)

const poly = (arr: [number, number][]) =>
  arr.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') + 'Z'

// Flat layer faces (top, right-front, left-front)
const layerTop = (cx: number, cy: number, s: number) =>
  poly([
    [cx, cy + s * IY],
    [cx + s * IX, cy],
    [cx, cy - s * IY],
    [cx - s * IX, cy],
  ])
const layerRight = (cx: number, cy: number, s: number, h: number) =>
  poly([
    [cx, cy + s * IY],
    [cx + s * IX, cy],
    [cx + s * IX, cy + h],
    [cx, cy + s * IY + h],
  ])
const layerLeft = (cx: number, cy: number, s: number, h: number) =>
  poly([
    [cx, cy + s * IY],
    [cx - s * IX, cy],
    [cx - s * IX, cy + h],
    [cx, cy + s * IY + h],
  ])

// Stroke / fill constants (always on dark polar-900 background)
const HI = 'rgba(255,255,255,0.55)' // bright highlight
const MID = 'rgba(255,255,255,0.32)' // mid tone
const DIM = 'rgba(255,255,255,0.18)' // subtle
const FT = 'rgba(255,255,255,0.10)' // face top fill
const FL = 'rgba(255,255,255,0.05)' // face side fill (left)
const FR = 'rgba(255,255,255,0.03)' // face side fill (right, shadow)

// ── Illustration 1: Stacked layers ───────────────────────────────────────────

const LayersIllustration = () => {
  const cx = 140
  const layers = [
    { cy: 226, s: 76 },
    { cy: 208, s: 64 },
    { cy: 192, s: 52 },
    { cy: 178, s: 40 },
    { cy: 165, s: 28 },
  ]
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="265"
      height="262"
      fill="none"
      viewBox="0 0 265 262"
    >
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 186.583 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 168.583 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 150.583 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 132.583 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 114.583 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#D0D6E0"
        stroke-width="0.5"
        d="M250.355 107.636a3.43 3.43 0 0 1 1.895 3.067v88.333a3.43 3.43 0 0 1-1.895 3.067l-111.972 55.985a13.71 13.71 0 0 1-12.266 0L14.145 202.103a3.43 3.43 0 0 1-1.895-3.067v-88.333c0-1.299.734-2.486 1.895-3.067l115.038-57.52a6.86 6.86 0 0 1 6.134 0z"
      ></path>
      <g filter="url(#filter0_d_3072_54146)">
        <path
          fill="#08090A"
          d="M250.355 66.493a3.43 3.43 0 0 1 1.895 3.067v9.476a3.43 3.43 0 0 1-1.895 3.067L136.85 138.855a10.29 10.29 0 0 1-9.2 0L14.145 82.103a3.43 3.43 0 0 1-1.895-3.067V69.56c0-1.299.734-2.486 1.895-3.067L129.183 8.974a6.86 6.86 0 0 1 6.134 0z"
        ></path>
        <path
          stroke="#D0D6E0"
          stroke-width="0.5"
          d="M250.355 66.493a3.43 3.43 0 0 1 1.895 3.067v9.476a3.43 3.43 0 0 1-1.895 3.067L136.85 138.855a10.29 10.29 0 0 1-9.2 0L14.145 82.103a3.43 3.43 0 0 1-1.895-3.067V69.56c0-1.299.734-2.486 1.895-3.067L129.183 8.974a6.86 6.86 0 0 1 6.134 0z"
        ></path>
      </g>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m19.107 71.726 108.543 54.272a10.29 10.29 0 0 0 9.2 0l108.543-54.272"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-width="0.5"
        d="M103.378 91.627c-.908-.281-.495-.95.573-.95h56.598c1.068 0 1.48.669.573.95-17.631 5.466-40.113 5.466-57.744 0ZM91.088 86.43c.205.117.502.183.813.183h80.697c.311 0 .608-.066.814-.182a42 42 0 0 0 4.679-3.057c.47-.357-.052-.824-.907-.824H87.316c-.856 0-1.378.467-.907.824a42 42 0 0 0 4.679 3.057ZM81.032 78.14c.16.21.564.346 1.013.346h100.409c.449 0 .853-.136 1.014-.346q1.152-1.502 1.939-3.05c.173-.34-.349-.667-1.052-.667H80.145c-.704 0-1.226.327-1.052.668a19.7 19.7 0 0 0 1.938 3.05ZM78.564 70.36c-.574 0-1.052-.222-1.084-.508-.849-7.528 4.478-15.198 15.98-20.95 21.423-10.71 56.157-10.71 77.58 0 11.502 5.752 16.828 13.422 15.979 20.95-.032.286-.51.507-1.084.507z"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-dasharray="1 3"
        stroke-linecap="round"
        d="M12.679 84.584v20.142M132.25 144.583v20.143M251.821 84.584v20.142"
      ></path>
      <defs>
        <filter
          id="filter0_d_3072_54146"
          width="264.5"
          height="156.191"
          x="0"
          y="0"
          color-interpolation-filters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
          <feColorMatrix
            in="SourceAlpha"
            result="hardAlpha"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          ></feColorMatrix>
          <feOffset dy="4"></feOffset>
          <feGaussianBlur stdDeviation="6"></feGaussianBlur>
          <feComposite in2="hardAlpha" operator="out"></feComposite>
          <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 0.6 0"></feColorMatrix>
          <feBlend
            in2="BackgroundImageFix"
            result="effect1_dropShadow_3072_54146"
          ></feBlend>
          <feBlend
            in="SourceGraphic"
            in2="effect1_dropShadow_3072_54146"
            result="shape"
          ></feBlend>
        </filter>
      </defs>
    </svg>
  )
}

// ── Illustration 2: Cube cluster ─────────────────────────────────────────────

const CubesIllustration = () => (
  <svg viewBox="0 0 272 267" fill="none" className="w-full">
    <defs>
      <filter
        id="c1"
        x="89"
        y="36"
        width="94"
        height="86"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 0.031 0 0 0 0 0.035 0 0 0 0 0.039 0 0 0 1 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
      <filter
        id="c2"
        x="147"
        y="85"
        width="79"
        height="73"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 0.031 0 0 0 0 0.035 0 0 0 0 0.039 0 0 0 1 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
      <filter
        id="c3"
        x="28"
        y="106"
        width="116"
        height="104"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 0.031 0 0 0 0 0.035 0 0 0 0 0.039 0 0 0 1 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
      <filter
        id="c4"
        x="126"
        y="111"
        width="116"
        height="104"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset />
        <feGaussianBlur stdDeviation="8" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix values="0 0 0 0 0.031 0 0 0 0 0.035 0 0 0 0 0.039 0 0 0 1 0" />
        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow" />
        <feBlend in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </filter>
    </defs>
    {/* Cube 1 – back center */}
    <g strokeWidth="0.5" filter="url(#c1)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M136,88 L167.2,106 L167.2,70 L136,52 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M136,88 L104.8,106 L104.8,70 L136,52 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M136,52 L167.2,70 L136,88 L104.8,70 Z"
      />
    </g>
    {/* Cube 2 – back right */}
    <g strokeWidth="0.5" filter="url(#c2)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M186,128 L209.4,141.5 L209.4,114.5 L186,101 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M186,128 L162.6,141.5 L162.6,114.5 L186,101 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M186,101 L209.4,114.5 L186,128 L162.6,114.5 Z"
      />
    </g>
    {/* Cube 3 – front left */}
    <g strokeWidth="0.5" filter="url(#c3)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M86,170 L127.6,194 L127.6,146 L86,122 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M86,170 L44.4,194 L44.4,146 L86,122 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M86,122 L127.6,146 L86,170 L44.4,146 Z"
      />
    </g>
    {/* Cube 4 – front right, highlighted */}
    <g filter="url(#c4)">
      <path
        fill="#08090A"
        stroke="#62666D"
        strokeWidth="0.5"
        d="M184,175 L225.6,199 L225.6,151 L184,127 Z"
      />
      <path
        fill="#08090A"
        stroke="#62666D"
        strokeWidth="0.5"
        d="M184,175 L142.4,199 L142.4,151 L184,127 Z"
      />
      <path
        fill="#08090A"
        stroke="#D0D6E0"
        strokeWidth="0.5"
        d="M184,127 L225.6,151 L184,175 L142.4,151 Z"
      />
      <path
        stroke="#3E3E44"
        strokeLinecap="round"
        d="M159,144 L182,155.5 M167,138 L180,145.5"
      />
    </g>
  </svg>
)

// ── Illustration 3: Fanned card stack ────────────────────────────────────────

const CardsIllustration = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="272"
    height="267"
    fill="none"
    viewBox="0 0 272 267"
    class="Benefits_momentum__42Pqx"
  >
    <g stroke-width="0.5" filter="url(#filter0_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M137.045 107.67a1.44 1.44 0 0 1 1.288 0l115.686 57.842a3.13 3.13 0 0 1 1.73 2.8v20.529a1.44 1.44 0 0 1-.796 1.288l-1.69.844a1.44 1.44 0 0 1-1.288 0l-115.686-57.842a3.13 3.13 0 0 1-1.73-2.8v-20.529c0-.545.308-1.044.795-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m137.689 110.448 113.061 56.531a3.38 3.38 0 0 1 1.869 3.023v18.193"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter1_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M128.596 98.374a1.44 1.44 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.8v34.049c0 .546-.308 1.045-.796 1.288l-1.691.845a1.44 1.44 0 0 1-1.288 0L127.84 137.356a3.13 3.13 0 0 1-1.731-2.799v-34.05c0-.546.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m129.239 101.153 113.061 56.53a3.38 3.38 0 0 1 1.869 3.024v31.713"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter2_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M120.145 82.318a1.44 1.44 0 0 1 1.288 0l115.685 57.842a3.13 3.13 0 0 1 1.731 2.8v54.331c0 .546-.309 1.044-.796 1.288l-1.691.845a1.44 1.44 0 0 1-1.288 0l-115.685-57.843a3.13 3.13 0 0 1-1.731-2.8v-54.33l.015-.202c.065-.464.354-.873.781-1.087z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m120.789 85.096 113.061 56.531a3.38 3.38 0 0 1 1.869 3.023v51.996"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter3_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M111.695 59.5a1.44 1.44 0 0 1 1.288 0l115.686 57.844a3.13 3.13 0 0 1 1.73 2.799v81.373a1.44 1.44 0 0 1-.795 1.288l-1.691.846a1.44 1.44 0 0 1-1.288 0l-115.686-57.843a3.13 3.13 0 0 1-1.73-2.799V61.633c0-.545.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="M112.339 62.28 225.4 118.81a3.38 3.38 0 0 1 1.868 3.023v79.038"
      ></path>
    </g>
    <g filter="url(#filter4_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#D0D6E0"
        stroke-width="0.5"
        d="M103.242 16.402a1.44 1.44 0 0 1 1.288 0l115.686 57.843a3.13 3.13 0 0 1 1.73 2.8v128.697a1.44 1.44 0 0 1-.796 1.288l-1.69.845a1.45 1.45 0 0 1-1.288 0l-115.686-57.843a3.13 3.13 0 0 1-1.73-2.8V18.535c0-.545.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        stroke-width="0.5"
        d="m103.887 19.18 113.061 56.531a3.38 3.38 0 0 1 1.868 3.024v126.361"
      ></path>
      <path
        stroke="#3E3E44"
        stroke-linecap="round"
        d="m111.914 36.505 32.958 16.901M111.914 44.956l16.056 8.45"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter5_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M94.793 67.951a1.44 1.44 0 0 1 1.288 0l115.686 57.843a3.13 3.13 0 0 1 1.73 2.8v81.373a1.44 1.44 0 0 1-.796 1.288l-1.69.846a1.45 1.45 0 0 1-1.288 0L94.037 154.258a3.13 3.13 0 0 1-1.73-2.8V70.084c0-.545.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m95.437 70.73 113.061 56.531a3.38 3.38 0 0 1 1.868 3.023v79.038"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter6_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M86.342 99.219a1.44 1.44 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.8v54.331a1.44 1.44 0 0 1-.796 1.288l-1.69.844a1.44 1.44 0 0 1-1.289 0L85.586 158.483a3.13 3.13 0 0 1-1.73-2.8v-54.331l.014-.201c.066-.465.354-.874.781-1.087z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m86.986 101.998 113.061 56.53a3.38 3.38 0 0 1 1.869 3.024v51.995"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter7_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M77.893 123.726a1.44 1.44 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.8v34.049a1.44 1.44 0 0 1-.796 1.289l-1.691.844a1.44 1.44 0 0 1-1.288 0L77.137 162.708a3.13 3.13 0 0 1-1.73-2.799v-34.05c0-.545.307-1.044.795-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m78.536 126.505 113.061 56.53a3.38 3.38 0 0 1 1.869 3.024v31.713"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter8_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M69.44 141.473a1.44 1.44 0 0 1 1.288 0l115.685 57.842a3.13 3.13 0 0 1 1.731 2.8v20.529c0 .545-.309 1.044-.796 1.288l-1.691.844a1.44 1.44 0 0 1-1.288 0L68.684 166.934a3.13 3.13 0 0 1-1.73-2.8v-20.529c0-.545.307-1.044.795-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m70.084 144.251 113.061 56.531a3.38 3.38 0 0 1 1.869 3.023v18.193"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter9_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M60.99 152.458a1.45 1.45 0 0 1 1.288 0l115.686 57.843a3.13 3.13 0 0 1 1.73 2.8v13.768a1.44 1.44 0 0 1-.796 1.288l-1.69.844a1.44 1.44 0 0 1-1.288 0L60.234 171.159a3.13 3.13 0 0 1-1.73-2.8v-13.768c0-.545.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m61.634 155.237 113.061 56.531a3.38 3.38 0 0 1 1.868 3.023v11.432"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter10_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M52.54 160.064a1.45 1.45 0 0 1 1.287 0l115.686 57.843a3.13 3.13 0 0 1 1.73 2.8v10.387a1.44 1.44 0 0 1-.796 1.289l-1.69.844a1.44 1.44 0 0 1-1.288 0L51.783 175.385a3.13 3.13 0 0 1-1.73-2.8v-10.388c0-.545.308-1.044.796-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m53.183 162.843 113.061 56.53a3.38 3.38 0 0 1 1.868 3.024v8.051"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter11_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M44.09 165.98a1.44 1.44 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.799v8.698a1.44 1.44 0 0 1-.796 1.288l-1.69.844a1.44 1.44 0 0 1-1.288 0L43.334 179.61a3.13 3.13 0 0 1-1.73-2.8v-8.697c0-.546.308-1.045.795-1.289z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m44.733 168.758 113.061 56.531a3.38 3.38 0 0 1 1.869 3.023v6.362"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter12_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M35.637 171.05a1.44 1.44 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.8v7.852a1.44 1.44 0 0 1-.796 1.288l-1.691.845a1.44 1.44 0 0 1-1.288 0L34.881 183.835a3.13 3.13 0 0 1-1.73-2.8v-7.852c0-.545.307-1.044.795-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m36.28 173.829 113.061 56.53a3.38 3.38 0 0 1 1.869 3.024v5.516"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter13_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M27.188 175.275a1.45 1.45 0 0 1 1.288 0l115.685 57.843a3.13 3.13 0 0 1 1.731 2.8v7.853a1.44 1.44 0 0 1-.796 1.288l-1.691.844a1.44 1.44 0 0 1-1.288 0L26.432 188.061a3.13 3.13 0 0 1-1.73-2.8v-7.853c0-.545.307-1.044.795-1.288z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m27.831 178.054 113.061 56.531a3.38 3.38 0 0 1 1.869 3.023v5.517"
      ></path>
    </g>
    <g stroke-width="0.5" filter="url(#filter14_d_3072_54198)">
      <path
        fill="#08090A"
        stroke="#62666D"
        d="M18.736 179.501a1.44 1.44 0 0 1 1.288 0l115.686 57.843a3.13 3.13 0 0 1 1.73 2.799v7.853c0 .545-.308 1.044-.795 1.288l-1.691.845a1.45 1.45 0 0 1-1.288 0L17.981 192.286a3.13 3.13 0 0 1-1.731-2.8v-7.852c0-.546.308-1.045.796-1.289z"
      ></path>
      <path
        stroke="#2E2E32"
        stroke-linecap="round"
        d="m19.38 182.28 113.061 56.53a3.38 3.38 0 0 1 1.868 3.023v5.517"
      ></path>
    </g>
    <defs>
      <filter
        id="filter0_d_3072_54198"
        width="153.691"
        height="116.507"
        x="118.309"
        y="91.068"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter1_d_3072_54198"
        width="153.69"
        height="130.028"
        x="109.859"
        y="81.772"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter2_d_3072_54198"
        width="153.69"
        height="150.31"
        x="101.408"
        y="65.716"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter3_d_3072_54198"
        width="153.691"
        height="177.153"
        x="92.958"
        y="43.099"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter4_d_3072_54198"
        width="153.691"
        height="224.676"
        x="84.506"
        y="-0.199"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter5_d_3072_54198"
        width="153.69"
        height="177.153"
        x="76.057"
        y="51.549"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter6_d_3072_54198"
        width="153.69"
        height="150.31"
        x="67.606"
        y="82.617"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter7_d_3072_54198"
        width="153.691"
        height="130.028"
        x="59.155"
        y="107.125"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter8_d_3072_54198"
        width="153.691"
        height="116.507"
        x="50.703"
        y="124.871"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter9_d_3072_54198"
        width="153.69"
        height="109.747"
        x="42.254"
        y="135.857"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter10_d_3072_54198"
        width="153.69"
        height="109.747"
        x="33.803"
        y="140.082"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter11_d_3072_54198"
        width="153.691"
        height="109.747"
        x="25.352"
        y="144.308"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter12_d_3072_54198"
        width="153.691"
        height="109.747"
        x="16.9"
        y="148.533"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter13_d_3072_54198"
        width="153.69"
        height="109.747"
        x="8.451"
        y="152.758"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
      <filter
        id="filter14_d_3072_54198"
        width="153.69"
        height="109.747"
        x="0"
        y="156.984"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feFlood flood-opacity="0" result="BackgroundImageFix"></feFlood>
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        ></feColorMatrix>
        <feOffset></feOffset>
        <feGaussianBlur stdDeviation="8"></feGaussianBlur>
        <feComposite in2="hardAlpha" operator="out"></feComposite>
        <feColorMatrix values="0 0 0 0 0.0313726 0 0 0 0 0.0352941 0 0 0 0 0.0392157 0 0 0 1 0"></feColorMatrix>
        <feBlend
          in2="BackgroundImageFix"
          result="effect1_dropShadow_3072_54198"
        ></feBlend>
        <feBlend
          in="SourceGraphic"
          in2="effect1_dropShadow_3072_54198"
          result="shape"
        ></feBlend>
      </filter>
    </defs>
  </svg>
)

// ── Feature card ─────────────────────────────────────────────────────────────

type FeatureCardProps = {
  fig: string
  title: string
  description: string
  illustration: React.ReactNode
  className?: string
}

const FeatureCard = ({
  fig,
  title,
  description,
  illustration,
  className,
}: FeatureCardProps) => (
  <motion.div
    variants={{
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 1.5 } },
    }}
    className={twMerge('flex flex-col', className)}
  >
    <div className="relative flex items-center justify-center px-6">
      <span className="dark:text-polar-500 absolute top-5 left-6 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
        {fig}
      </span>
    </div>
    <div className="flex h-96 items-center justify-center">{illustration}</div>
    <div className="flex flex-col gap-y-2 px-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="dark:text-polar-500 leading-relaxed text-gray-500">
        {description}
      </p>
    </div>
  </motion.div>
)

// ── Main export ───────────────────────────────────────────────────────────────

const Features = ({ className }: { className?: string }) => (
  <section className={className}>
    <motion.div
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.15 }}
      className="dark:divide-polar-700 grid grid-cols-1 gap-4 divide-x-0 divide-y divide-gray-200 md:grid-cols-3 md:gap-6 md:divide-x md:divide-y-0"
    >
      <FeatureCard
        fig="0.1"
        title="Payments, Usage & Billing"
        description="Create digital products and SaaS billing with flexible pricing models and seamless payment processing."
        illustration={<LayersIllustration />}
      />
      <FeatureCard
        fig="0.2"
        title="Customer Management"
        description="Streamlined customer lifecycle management with detailed profiles and analytics."
        illustration={<CubesIllustration />}
      />
      <FeatureCard
        fig="0.3"
        title="Global Merchant of Record"
        description="Focus on your passion while we handle all headaches & tax compliance."
        illustration={<CardsIllustration />}
      />
    </motion.div>
  </section>
)

export default Features

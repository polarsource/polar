import React from 'react'
import { useState, ReactNode } from 'react'
import { resolveBenefitIcon } from '../Benefit/utils'
import { BenefitPublicInner } from '@polar-sh/sdk'
import {
  AddOutlined,
  KeyboardArrowUp,
  KeyboardArrowRight,
} from '@mui/icons-material'


const AMOUNT_SHOWN = 5

const BenefitRow = ({
  icon,
  children,
}: {
  icon: ReactNode,
  children: ReactNode
}) => {
  return (
    <div className="flex flex-row items-center gap-x-3">
      <span className="flex h-4 w-4 items-center justify-center text-2xl text-black dark:text-white">
        {icon}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

export const BenefitList = ({
  benefits,
  toggle = false
}: {
  benefits: BenefitPublicInner[] | undefined
  toggle?: boolean
}) => {
  const [showAll, setShowAll] = useState(false)

  if (!benefits) return <></>

  const shown = benefits.slice(0, AMOUNT_SHOWN)
  const toggled = benefits.slice(AMOUNT_SHOWN)

  const onToggle = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setShowAll(!showAll)
  }

  return (
    <>
      {shown.map((benefit) => (
        <BenefitRow key={benefit.id} icon={resolveBenefitIcon(benefit, 'inherit')}>
          {benefit.description}
        </BenefitRow>
      ))}
      {toggled.length > 0 && (
        <>
          {showAll && toggled.map((benefit) => (
            <BenefitRow key={benefit.id} icon={resolveBenefitIcon(benefit, 'inherit')}>
              {benefit.description}
            </BenefitRow>
          ))}

          {!toggle && (
            <BenefitRow key="show" icon={<AddOutlined className="w-3 h-3" />}>
              {toggled.length} more benefits
            </BenefitRow>
          )}

          {toggle && (
            <a href="#" onClick={onToggle}>
              {showAll && (
                <BenefitRow key="hide" icon={<KeyboardArrowUp />}>
                  Show less
                </BenefitRow>
              )}
              {!showAll && (
                <BenefitRow key="show" icon={<KeyboardArrowRight />}>
                  Show {toggled.length} more benefits
                </BenefitRow>
              )}
            </a>
          )}
        </>
      )}
    </>
  )
}

'use client'

import { motion } from 'framer-motion'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Isometric, IsometricBox } from './Isometric'

// ── Illustration 1: Billing / usage bar chart ────────────────────────────────

const BillingIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    <div style={{ transform: 'translateY(36px)' }}>
      <Isometric style={{ width: 200, height: 130 }}>
        {/* Base plate */}
        <IsometricBox
          x={0}
          y={20}
          z={0}
          width={200}
          height={100}
          depth={4}
          topStyle={{ background: CARD_BG, border: DIM_BORDER }}
          frontStyle={{ background: FRONT_BG }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Bar 1 – short */}
        <IsometricBox
          x={12}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={32}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: DIM_BORDER }}
        />
        {/* Bar 2 – medium */}
        <IsometricBox
          x={46}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={56}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: DIM_BORDER }}
        />
        {/* Bar 3 – medium-short */}
        <IsometricBox
          x={80}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={42}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: DIM_BORDER }}
        />
        {/* Bar 4 – tallest, highlighted */}
        <IsometricBox
          x={114}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={84}
          topStyle={{ background: CARD_BG, border: HI_BORDER }}
          frontStyle={{ background: FRONT_BG, border: MID_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: MID_BORDER }}
        />
        {/* Bar 5 – medium-tall */}
        <IsometricBox
          x={148}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={62}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: DIM_BORDER }}
        />
      </Isometric>
    </div>
  </div>
)

// ── Illustration 2: Customer cards (CSS isometric) ───────────────────────────

const DIM_BORDER = '0.5px solid #3E3E44'
const MID_BORDER = '0.5px solid #62666D'
const HI_BORDER = '0.5px solid #D0D6E0'
const CARD_BG = '#08090A'
const FRONT_BG = '#040506'
const RIGHT_BG = '#020304'

const CustomerIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    {/* Offset wrapper to visually center the isometric scene */}
    <div style={{ transform: 'translateY(-24px) translateX(8px)' }}>
      <Isometric style={{ width: 200, height: 160 }}>
        {/* Card 3 – back (dimmest) */}
        <IsometricBox
          x={40}
          y={40}
          z={0}
          width={150}
          height={100}
          depth={5}
          topStyle={{ background: CARD_BG, border: DIM_BORDER }}
          frontStyle={{ background: FRONT_BG }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Card 2 – middle */}
        <IsometricBox
          x={20}
          y={20}
          z={28}
          width={150}
          height={100}
          depth={5}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: MID_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: MID_BORDER }}
        />
        {/* Card 1 – front (highlighted) */}
        <IsometricBox
          x={0}
          y={0}
          z={56}
          width={150}
          height={100}
          depth={5}
          topStyle={{ background: CARD_BG, border: HI_BORDER }}
          frontStyle={{ background: FRONT_BG, border: HI_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: HI_BORDER }}
        />
        {/* Header bar on front card */}
        <IsometricBox
          x={12}
          y={12}
          z={62}
          width={90}
          height={8}
          depth={2}
          topStyle={{ background: '#D0D6E0', opacity: 0.35 }}
          frontStyle={{ background: '#D0D6E0', opacity: 0.1 }}
          rightStyle={{ background: '#D0D6E0', opacity: 0.08 }}
        />
        {/* Data row 1 */}
        <IsometricBox
          x={12}
          y={30}
          z={62}
          width={70}
          height={6}
          depth={1}
          topStyle={{ background: '#62666D', opacity: 0.55 }}
          frontStyle={{ background: '#62666D', opacity: 0.15 }}
          rightStyle={{ background: '#62666D', opacity: 0.1 }}
        />
        {/* Data row 2 */}
        <IsometricBox
          x={12}
          y={46}
          z={62}
          width={85}
          height={6}
          depth={1}
          topStyle={{ background: '#62666D', opacity: 0.4 }}
          frontStyle={{ background: '#62666D', opacity: 0.1 }}
          rightStyle={{ background: '#62666D', opacity: 0.08 }}
        />
        {/* Data row 3 */}
        <IsometricBox
          x={12}
          y={62}
          z={62}
          width={55}
          height={6}
          depth={1}
          topStyle={{ background: '#62666D', opacity: 0.3 }}
          frontStyle={{ background: '#62666D', opacity: 0.08 }}
          rightStyle={{ background: '#62666D', opacity: 0.06 }}
        />
      </Isometric>
    </div>
  </div>
)

// ── Illustration 3: Global merchant panels ──────────────────────────────────

const MerchantIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    <div style={{ transform: 'translateY(-20px) translateX(4px)' }}>
      <Isometric style={{ width: 220, height: 160 }}>
        {/* Base world surface */}
        <IsometricBox
          x={0}
          y={0}
          z={0}
          width={220}
          height={160}
          depth={4}
          topStyle={{ background: CARD_BG, border: DIM_BORDER }}
          frontStyle={{ background: FRONT_BG }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Region – top left */}
        <IsometricBox
          x={8}
          y={8}
          z={4}
          width={65}
          height={48}
          depth={5}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Region – top right */}
        <IsometricBox
          x={138}
          y={6}
          z={4}
          width={70}
          height={48}
          depth={5}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Region – center, highlighted */}
        <IsometricBox
          x={60}
          y={52}
          z={4}
          width={92}
          height={62}
          depth={8}
          topStyle={{ background: CARD_BG, border: HI_BORDER }}
          frontStyle={{ background: FRONT_BG, border: MID_BORDER }}
          rightStyle={{ background: RIGHT_BG, border: MID_BORDER }}
        />
        {/* Region – bottom left */}
        <IsometricBox
          x={6}
          y={100}
          z={4}
          width={54}
          height={48}
          depth={5}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Region – bottom right */}
        <IsometricBox
          x={152}
          y={98}
          z={4}
          width={58}
          height={48}
          depth={5}
          topStyle={{ background: CARD_BG, border: MID_BORDER }}
          frontStyle={{ background: FRONT_BG, border: DIM_BORDER }}
          rightStyle={{ background: RIGHT_BG }}
        />
        {/* Details on highlighted region */}
        <IsometricBox
          x={68}
          y={60}
          z={13}
          width={65}
          height={7}
          depth={2}
          topStyle={{ background: '#D0D6E0', opacity: 0.35 }}
          frontStyle={{ background: '#D0D6E0', opacity: 0.1 }}
          rightStyle={{ background: '#D0D6E0', opacity: 0.06 }}
        />
        <IsometricBox
          x={68}
          y={76}
          z={13}
          width={45}
          height={5}
          depth={1}
          topStyle={{ background: '#62666D', opacity: 0.55 }}
          frontStyle={{ background: '#62666D', opacity: 0.12 }}
          rightStyle={{ background: '#62666D', opacity: 0.06 }}
        />
        <IsometricBox
          x={68}
          y={90}
          z={13}
          width={56}
          height={5}
          depth={1}
          topStyle={{ background: '#62666D', opacity: 0.4 }}
          frontStyle={{ background: '#62666D', opacity: 0.08 }}
          rightStyle={{ background: '#62666D', opacity: 0.04 }}
        />
      </Isometric>
    </div>
  </div>
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
        illustration={<BillingIllustration />}
      />
      <FeatureCard
        fig="0.2"
        title="Customer Management"
        description="Streamlined customer lifecycle management with detailed profiles and analytics."
        illustration={<CustomerIllustration />}
      />
      <FeatureCard
        fig="0.3"
        title="Global Merchant of Record"
        description="Focus on your passion while we handle all headaches & tax compliance."
        illustration={<MerchantIllustration />}
      />
    </motion.div>
  </section>
)

export default Features

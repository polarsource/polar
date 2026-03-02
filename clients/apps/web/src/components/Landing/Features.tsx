'use client'

import { motion } from 'framer-motion'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Isometric, IsometricBox } from './Isometric'

// ── Shared face / edge classes ────────────────────────────────────────────────

// Base face colors: grays in light mode, near-black in dark mode
const FACE_T = 'bg-gray-100 dark:bg-[#08090A]'
const FACE_F = 'bg-gray-200 dark:bg-[#040506]'
const FACE_R = 'bg-gray-300 dark:bg-[#020304]'

// Border edge variants: gray palette in light, progressively brighter in dark
const EDGE_DIM = 'border-[0.5px] border-gray-200 dark:border-[#3E3E44]'
const EDGE_MID = 'border-[0.5px] border-gray-300 dark:border-[#62666D]'
const EDGE_HI = 'border-[0.5px] border-gray-500 dark:border-[#D0D6E0]'

// ── Illustration 1: Billing / usage bar chart ─────────────────────────────────

const BillingIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    <div style={{ transform: 'translateY(-10px) scale(1.4)' }}>
      <Isometric style={{ width: 200, height: 130 }}>
        {/* Base plate */}
        <IsometricBox
          x={0}
          y={20}
          z={0}
          width={200}
          height={100}
          depth={4}
          topClassName={`${FACE_T} ${EDGE_DIM}`}
          frontClassName={FACE_F}
          rightClassName={FACE_R}
        />
        {/* Bar 1 – short */}
        <IsometricBox
          x={12}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={32}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={`${FACE_R} ${EDGE_DIM}`}
        />
        {/* Bar 2 – medium */}
        <IsometricBox
          x={46}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={56}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={`${FACE_R} ${EDGE_DIM}`}
        />
        {/* Bar 3 – medium-short */}
        <IsometricBox
          x={80}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={42}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={`${FACE_R} ${EDGE_DIM}`}
        />
        {/* Bar 4 – tallest, highlighted */}
        <IsometricBox
          x={114}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={84}
          topClassName={`${FACE_T} ${EDGE_HI}`}
          frontClassName={`${FACE_F} ${EDGE_MID}`}
          rightClassName={`${FACE_R} ${EDGE_MID}`}
        />
        {/* Bar 5 – medium-tall */}
        <IsometricBox
          x={148}
          y={38}
          z={4}
          width={24}
          height={60}
          depth={62}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={`${FACE_R} ${EDGE_DIM}`}
        />
      </Isometric>
    </div>
  </div>
)

// ── Illustration 2: Customer cards ───────────────────────────────────────────

const CustomerIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    <div style={{ transform: 'translateY(8px) scale(1.4)' }}>
      <Isometric style={{ width: 200, height: 160 }}>
        {/* Card 3 – back (dimmest) */}
        <IsometricBox
          x={40}
          y={40}
          z={0}
          width={150}
          height={100}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_DIM}`}
          frontClassName={FACE_F}
          rightClassName={FACE_R}
        />
        {/* Card 2 – middle */}
        <IsometricBox
          x={20}
          y={20}
          z={28}
          width={150}
          height={100}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_MID}`}
          rightClassName={`${FACE_R} ${EDGE_MID}`}
        />
        {/* Card 1 – front (highlighted) */}
        <IsometricBox
          x={0}
          y={0}
          z={56}
          width={150}
          height={100}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_HI}`}
          frontClassName={`${FACE_F} ${EDGE_HI}`}
          rightClassName={`${FACE_R} ${EDGE_HI}`}
        />
        {/* Header bar on front card */}
        <IsometricBox
          x={12}
          y={12}
          z={62}
          width={90}
          height={2}
          depth={2}
          topClassName="bg-gray-400/40 dark:bg-[#D0D6E0]/35"
          frontClassName="bg-gray-300/15 dark:bg-[#D0D6E0]/10"
          rightClassName="bg-gray-200/10 dark:bg-[#D0D6E0]/8"
        />
        {/* Data row 1 */}
        <IsometricBox
          x={12}
          y={20}
          z={62}
          width={70}
          height={2}
          depth={1}
          topClassName="bg-gray-400/55 dark:bg-[#62666D]/55"
          frontClassName="bg-gray-300/15 dark:bg-[#62666D]/15"
          rightClassName="bg-gray-200/10 dark:bg-[#62666D]/10"
        />
        {/* Data row 2 */}
        <IsometricBox
          x={12}
          y={30}
          z={62}
          width={32}
          height={2}
          depth={1}
          topClassName="bg-gray-400/40 dark:bg-[#62666D]/40"
          frontClassName="bg-gray-300/10 dark:bg-[#62666D]/10"
          rightClassName="bg-gray-200/8 dark:bg-[#62666D]/8"
        />
      </Isometric>
    </div>
  </div>
)

// ── Illustration 3: Global merchant panels ────────────────────────────────────

const MerchantIllustration = () => (
  <div className="flex h-full w-full items-center justify-center overflow-hidden">
    <div style={{ transform: 'translateY(4px) translateX(-8px) scale(1.4)' }}>
      <Isometric style={{ width: 220, height: 160 }}>
        {/* Base world surface */}
        <IsometricBox
          x={0}
          y={0}
          z={0}
          width={220}
          height={160}
          depth={4}
          topClassName={`${FACE_T} ${EDGE_DIM}`}
          frontClassName={FACE_F}
          rightClassName={FACE_R}
        />
        {/* Region – top left */}
        <IsometricBox
          x={8}
          y={8}
          z={4}
          width={65}
          height={48}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={FACE_R}
        />
        {/* Region – top right */}
        <IsometricBox
          x={138}
          y={6}
          z={4}
          width={70}
          height={48}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={FACE_R}
        />
        {/* Region – center, highlighted */}
        <IsometricBox
          x={60}
          y={52}
          z={4}
          width={92}
          height={62}
          depth={8}
          topClassName={`${FACE_T} ${EDGE_HI}`}
          frontClassName={`${FACE_F} ${EDGE_MID}`}
          rightClassName={`${FACE_R} ${EDGE_MID}`}
        />
        {/* Region – bottom left */}
        <IsometricBox
          x={6}
          y={100}
          z={4}
          width={54}
          height={48}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={FACE_R}
        />
        {/* Region – bottom right */}
        <IsometricBox
          x={152}
          y={98}
          z={4}
          width={58}
          height={48}
          depth={5}
          topClassName={`${FACE_T} ${EDGE_MID}`}
          frontClassName={`${FACE_F} ${EDGE_DIM}`}
          rightClassName={FACE_R}
        />
        {/* Details on highlighted region */}
        <IsometricBox
          x={68}
          y={64}
          z={13}
          width={65}
          height={2}
          depth={2}
          topClassName="bg-gray-400/40 dark:bg-[#D0D6E0]/35"
          frontClassName="bg-gray-300/10 dark:bg-[#D0D6E0]/10"
          rightClassName="bg-gray-200/6 dark:bg-[#D0D6E0]/6"
        />
        <IsometricBox
          x={68}
          y={70}
          z={13}
          width={45}
          height={2}
          depth={1}
          topClassName="bg-gray-400/55 dark:bg-[#62666D]/55"
          frontClassName="bg-gray-300/12 dark:bg-[#62666D]/12"
          rightClassName="bg-gray-200/6 dark:bg-[#62666D]/6"
        />
        <IsometricBox
          x={68}
          y={76}
          z={13}
          width={32}
          height={2}
          depth={1}
          topClassName="bg-gray-400/40 dark:bg-[#62666D]/40"
          frontClassName="bg-gray-300/8 dark:bg-[#62666D]/8"
          rightClassName="bg-gray-200/4 dark:bg-[#62666D]/4"
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

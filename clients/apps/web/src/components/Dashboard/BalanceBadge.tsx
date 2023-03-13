import { ArrowRightCircleIcon as SolidArrowRightCircleIcon } from '@heroicons/react/24/solid'

const BalanceBadge = () => {
  return (
    <div className="flex cursor-pointer items-center space-x-3 rounded-full border-2 border-[#E5DEF5] bg-[#F9F7FD] py-1 pr-1.5 pl-3 text-[#7556BA] transition-colors duration-100 hover:bg-[#E5DEF5]">
      <span>$123.40</span>
      <SolidArrowRightCircleIcon
        className="h-6 w-6 text-[#9171D9]"
        aria-hidden="true"
      />
    </div>
  )
}
export default BalanceBadge

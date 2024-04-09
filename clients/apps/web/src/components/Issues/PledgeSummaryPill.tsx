import { ClockIcon, HeartIcon } from '@heroicons/react/20/solid'
import { PledgesSummary } from '@polar-sh/sdk'
import { getCentsInDollarString } from 'polarkit/money'
import Pledgers from './Pledgers'

interface BasePledgeSummaryPillProps {
  summary: PledgesSummary
  icon: React.ReactElement
  label: string
}

const BasePledgeSummaryPill: React.FC<BasePledgeSummaryPillProps> = ({
  summary,
  icon,
  label,
}) => {
  return (
    <div className="flex flex-row items-center">
      <div className="hidden md:block">
        <Pledgers pledgers={summary.pledgers} maxShown={3} size="xs" />
      </div>
      <div className="dark:bg-polar-700 dark:border-polar-600 dark:text-polar-200 -ml-2 flex flex-row items-center gap-1 rounded-full border border-gray-200 bg-white py-0.5 pl-1 pr-2 text-xs text-gray-700">
        {icon}
        <span>
          ${getCentsInDollarString(summary.total.amount, false, true)}
        </span>
        <span>{label}</span>
      </div>
    </div>
  )
}

interface PledgeSummaryPillProps {
  summary: PledgesSummary
}

const Funded: React.FC<PledgeSummaryPillProps> = ({ summary }) => {
  return (
    <BasePledgeSummaryPill
      summary={summary}
      icon={<HeartIcon className="h-4 w-4 text-red-600" />}
      label="Funded"
    />
  )
}

const Pledged: React.FC<PledgeSummaryPillProps> = ({ summary }) => {
  return (
    <BasePledgeSummaryPill
      summary={summary}
      icon={<ClockIcon className="h-4 w-4 text-yellow-600" />}
      label="Pledged"
    />
  )
}

const PledgeSummaryPill = {
  Funded,
  Pledged,
}

export default PledgeSummaryPill

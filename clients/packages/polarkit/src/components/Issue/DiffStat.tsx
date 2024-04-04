import { twMerge } from 'tailwind-merge'

const DiffStat = (props: {
  additions: number | undefined
  deletions: number | undefined
}) => {
  /*
   * Generate the diffstat boxes as seen on Github.
   *
   * We're mimicking how these boxes are generated on Github vs. solely percentage based.
   * After some experimentation the logic and rules are:
   * - 5 boxes
   * - Additions (green) > Deletions (red) > Empty (gray)
   * - A box can only be claimed by full 20% steps, i.e 39% is 1 box, 40% is 2 boxes
   * - Resulting in the last box always being gray unless it's a perfect 100% of deletions or additions
   */
  const boxCount = 5
  const threshold = 1 / boxCount
  const additions = props.additions || 0
  const deletions = props.deletions || 0
  const total = additions + deletions

  // Default to all empty, e.g opened branch/PR with no changes
  let emptyBoxes = boxCount
  let additionBoxes = 0
  let deletionBoxes = 0
  if (total > 0) {
    additionBoxes = Math.floor(additions / total / threshold)
    deletionBoxes = Math.floor(deletions / total / threshold)
    emptyBoxes = boxCount - additionBoxes - deletionBoxes
  }

  const generateDiffBox = (className: string, boxes: number) => {
    if (boxes <= 0) return <></>

    const iterations = [...Array(boxes)]
    return iterations.map((_, i) => {
      return (
        <span
          key={i}
          className={twMerge(
            className,
            'ml-0.5 inline-block h-2.5 w-2.5 border dark:border-white/10',
          )}
        >
          {' '}
        </span>
      )
    })
  }

  return (
    <div className="hidden flex-shrink-0 flex-nowrap items-center gap-2 lg:flex">
      <span className="text-green-400 dark:text-green-500">
        +{props.additions}
      </span>
      <span className="text-red-400 dark:text-red-500">-{props.deletions}</span>
      <span>
        {generateDiffBox('bg-green-200 dark:bg-green-400/50', additionBoxes)}
        {generateDiffBox('bg-red-200 dark:bg-red-400/50', deletionBoxes)}
        {generateDiffBox('bg-gray-200 dark:bg-polar-400/50', emptyBoxes)}
      </span>
    </div>
  )
}

export default DiffStat

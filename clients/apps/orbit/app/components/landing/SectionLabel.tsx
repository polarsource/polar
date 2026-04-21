/**
 * SectionLabel — section number (mono) + optional label (sans).
 */
export const SectionLabel = ({
  number,
  label,
}: {
  number: string;
  label?: string;
}) => (
  <div className="flex items-center gap-4 text-xl text-neutral-900 dark:text-white">
    <span className="font-[family-name:var(--font-mono)]">{number}</span>
    {label && (
      <>
        <span className="h-px w-8 bg-white" />
        <span>{label}</span>
      </>
    )}
  </div>
);

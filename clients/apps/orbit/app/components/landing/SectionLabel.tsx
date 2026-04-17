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
  <div className="flex items-center gap-4 text-base text-white">
    <span className="font-[family-name:var(--font-geist-mono)]">{number}</span>
    {label && (
      <>
        <span className="h-px w-8 bg-neutral-700" />
        <span>{label}</span>
      </>
    )}
  </div>
);

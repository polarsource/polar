import { Section } from '@/components/Landing/Section'

export default function Layout({ children }: { children: React.ReactNode }) {
  // Create any shared layout or styles here
  return (
    <Section className="md:py-0">
      <div className="prose dark:prose-invert dark:prose-headings:leading-normal prose-headings:leading-normal prose-headings:mt-16 prose-headings:font-semibold prose-headings:text-black prose-h1:text-blue-500 prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-h5:text-lg prose-h6:text-md dark:prose-headings:text-white dark:text-polar-200 max-w-4xl text-gray-800">
        {children}
      </div>
    </Section>
  )
}

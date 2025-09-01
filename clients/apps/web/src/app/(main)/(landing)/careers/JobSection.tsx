import { JobLink, JobLinkProps } from './JobLink'

export interface JobSectionProps {
  title: string
  jobs: JobLinkProps[]
}

export const JobSection = ({ title, jobs }: JobSectionProps) => {
  return (
    <section className="grid grid-cols-1 gap-4 border-gray-300 pt-4 md:grid-cols-3 md:gap-8 md:border-t dark:border-gray-700">
      <div className="sticky top-0 col-span-1 flex h-fit flex-col text-lg md:text-base">
        <h4 className="mt-0">{title}</h4>
      </div>
      <div className="col-span-2 flex flex-col divide-y divide-gray-300 dark:divide-gray-700 [&>*:first-child]:pt-2 [&>*:last-child]:pb-0">
        {jobs.map((job) => (
          <JobLink key={job.link} {...job} />
        ))}
      </div>
    </section>
  )
}

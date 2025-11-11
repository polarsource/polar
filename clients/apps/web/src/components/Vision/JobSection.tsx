import { JobLink, JobLinkProps } from './JobLink'

export interface JobSectionProps {
  title: string
  jobs: JobLinkProps[]
}

export const JobSection = ({ title, jobs }: JobSectionProps) => {
  return (
    <section className="flex flex-col gap-6 lg:gap-8">
      <h4 className="text-xl">{title}</h4>
      <div className="flex flex-col gap-2">
        {jobs.map((job) => (
          <JobLink key={job.link} {...job} />
        ))}
      </div>
    </section>
  )
}

export class SchemaError extends Error {
  readonly subject: string
  readonly problem: string

  constructor(subject: string, problem: string) {
    super(`${subject}: ${problem}`)
    this.name = 'SchemaError'
    this.subject = subject
    this.problem = problem
  }
}

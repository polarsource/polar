/** A hash as the CLI prints it in tables. */
export const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`

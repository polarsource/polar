import { formatDuration, add } from 'date-fns'

export class ISODuration {
  protected years?: number
  protected months?: number
  protected weeks?: number
  protected days?: number
  protected hours?: number
  protected minutes?: number
  protected seconds?: number

  constructor(duration: string) {
    const dateMatch = duration.match(
      /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?/i,
    )
    const timeMatch = duration.match(
      /(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
    )

    if (!dateMatch) return

    const [, yearsStr, monthsStr, weeksStr, daysStr] = dateMatch
    const [, hoursStr, minutesStr, secondsStr] = timeMatch || []

    if (yearsStr) this.years = parseInt(yearsStr, 10)
    if (monthsStr) this.months = parseInt(monthsStr, 10)
    if (weeksStr) this.weeks = parseInt(weeksStr, 10)
    if (daysStr) this.days = parseInt(daysStr, 10)
    if (hoursStr) this.hours = parseInt(hoursStr, 10)
    if (minutesStr) this.minutes = parseInt(minutesStr, 10)
    if (secondsStr) this.seconds = parseFloat(secondsStr)
  }

  public format(): string {
    return formatDuration({
      years: this.years,
      months: this.months,
      weeks: this.weeks,
      days: this.days,
      hours: this.hours,
      minutes: this.minutes,
      seconds: this.seconds,
    })
  }

  public isNonZero(): boolean {
    return !!(
      this.years ||
      this.months ||
      this.weeks ||
      this.days ||
      this.hours ||
      this.minutes ||
      this.seconds
    )
  }

  public addToDate(date: Date): Date {
    return add(date, {
      years: this.years,
      months: this.months,
      weeks: this.weeks,
      days: this.days,
      hours: this.hours,
      minutes: this.minutes,
      seconds: this.seconds,
    })
  }
}

import { Type, ValidationError } from "@mikro-orm/core"
import { DateTime, Duration, Interval } from "luxon"

/**
 * Checks whether the provided date is the same date as another
 * @param one The first date to check
 * @param two The date to check against. If not provided, today will be used
 * @returns A boolean indicating same date or not
 */
export function IsSameDate(one: DateTime | string, two: DateTime | string = DateTime.now()) {
  if (typeof one === "string") {
    one = DateTime.fromISO(one)
  }
  if (typeof two === "string") {
    two = DateTime.fromISO(two)
  }
  return one.day === two.day && one.month === two.month
}

/**
 * Calculate the amount of days untill someone's birthday and also what age they'll turn
 * @param birthDate The date someone was born
 */
export function calculateDaysTillBirthDay(birthDate: DateTime): { days: number; age: number } {
  let nextBirthDay = birthDate.set({ year: DateTime.now().year })
  // Calculate next birthday requires logic for checking if birthday has passed
  //nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  const now = DateTime.now()
  if (now > nextBirthDay) {
    nextBirthDay = nextBirthDay.plus({ year: 1 })
  }
  const days = Math.floor(Interval.fromDateTimes(now, nextBirthDay).length("days") + 1)
  const nextAge = Math.ceil(Interval.fromDateTimes(birthDate, now).length("year"))
  return { days, age: nextAge }
}

export enum ErrorType {
  MemberNotFound,
  PrivateInformation,

  CongressusNetworkError,
}

export class MyError extends Error {
  public readonly type: ErrorType
  constructor(type: ErrorType) {
    super(type.toString())
    this.type = type
  }
}
export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[]
}

export function isMemberOfEnum(str: string | number, e: object) {
  for (const key of enumKeys(e)) {
    if (str === e[key]) {
      return true
    }
  }
  return false
}

export class LuxonDate extends Type<DateTime | undefined, string | undefined> {
  convertToDatabaseValue(value: DateTime | string | undefined): string | undefined {
    if (value instanceof DateTime) {
      return value.toISO()
    } else if (typeof value === "string" || value == null) {
      return value
    } else {
      throw ValidationError.invalidType(LuxonDate, value, "JS")
    }
  }

  convertToJSValue(value: string | undefined): DateTime | undefined {
    if (value != null) {
      return DateTime.fromISO(value)
    } else {
      return value
    }
  }
  getColumnType(): string {
    return "varchar(30)"
  }

  compareAsType(): string {
    return "string"
  }
}

export class LuxonDuration extends Type<Duration | undefined, string | undefined> {
  convertToDatabaseValue(value: Duration | string | undefined): string | undefined {
    if (value instanceof Duration) {
      return value.toISO()
    } else if (typeof value === "string" || value == null) {
      return value
    } else {
      throw ValidationError.invalidType(LuxonDate, value, "JS")
    }
  }

  convertToJSValue(value: string | undefined): Duration | undefined {
    if (value != null) {
      return Duration.fromISO(value)
    } else {
      return value
    }
  }
  getColumnType(): string {
    return "varchar(30)"
  }

  compareAsType(): string {
    return "string"
  }
}

export function getRandomLocation() {
  return {
    long: getRandomInRange(-180, 180, 4),
    lat: getRandomInRange(-180, 180, 4),
  }
}

export function getRandomInRange(from: number, to: number, decimalPlaces: number) {
  return Math.round((Math.random() * (to - from) + from) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
}

const rateLimitStore = new Map<string, number[]>()

export const checkAndInsertRateLimit = (key: string, maxRequests: number, timeWindow: number) => {
  let relevantResquests: number[] = []
  if (rateLimitStore.has(key)) {
    const requests = rateLimitStore.get(key) as number[]
    relevantResquests = requests.filter(r => r > Date.now() - timeWindow)
  }
  const result = relevantResquests.length < maxRequests
  rateLimitStore.set(key, [...relevantResquests, Date.now()])
  return result
}

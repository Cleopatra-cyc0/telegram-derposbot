import fetch from "node-fetch"
import { CongressusMember } from "./model"

/**
 * Checks whether the provided date is the same date as another
 * @param one The first date to check
 * @param two The date to check against. If not provided, today will be used
 * @returns A boolean indicating same date or not
 */
export function IsSameDate(one: Date | string, two: Date | string = new Date()) {
  if (typeof one === "string") {
    one = new Date(one)
  }
  if (typeof two === "string") {
    two = new Date(two)
  }
  return one.getDate() === two.getDate() && one.getMonth() === two.getMonth()
}

/**
 * Calculate the amount of days untill someone's birthday and also what age they'll turn
 * @param birthDate The date someone was born
 */
export function calculateDaysTillBirthDay(birthDate: Date): { days: number; age: number } {
  const nextBirthDay = new Date(birthDate)
  // Calculate next birthday requires logic for checking if birthday has passed
  //nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  const now = new Date()
  if (
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() > birthDate.getDate())
  ) {
    nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  } else {
    nextBirthDay.setFullYear(new Date().getFullYear())
  }
  const totalSeconds = nextBirthDay.getTime() - Date.now()
  const days = Math.floor(totalSeconds / 86400000)
  const nextAge = Math.abs(new Date(Date.now() - birthDate.getTime()).getFullYear() - 1970) + 1
  return { days, age: nextAge }
}

export enum ErrorType {
  MemberNotFound,
  PrivateInformation,
}

export class MyError extends Error {
  public readonly type: ErrorType
  constructor(type: ErrorType) {
    super(type.toString())
    this.type = type
  }
}

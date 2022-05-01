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

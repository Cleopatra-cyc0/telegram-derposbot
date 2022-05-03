import { ErrorType, IsSameDate, MyError } from "./util"
import logger, { track } from "./log"
import fetch, { FetchError } from "node-fetch"
import { DateTime } from "luxon"

const congressusToken = process.env.CONGRESSUS_TOKEN
export type CongressusMember = {
  id: 0
  username: string
  status_id: 0
  status: string
  email: string
  gender: string
  initials: string
  given_name: string
  first_name: string
  primary_last_name_prefix: string
  primary_last_name_main: string
  secondary_last_name_prefix: string
  secondary_last_name_main: string
  date_of_birth: `${number}-${number}-${number}`
  address: {
    address: string
    zip: string
    city: string
    country: string
  }
  phone_mobile: {
    number_full: string
    number_full_MSISDN: string
  }
  phone_home: {
    number_full: string
    number_full_MSISDN: string
  }
  bank_account: {
    iban: string
    bic: string
    has_sdd_mandate: boolean
  }
  profile_picture: {
    id: 0
    name: string
    url: string
    url_sm: string
    url_md: string
    url_lg: string
    is_image: boolean
  }
  formal_picture: {
    id: 0
    name: string
    url: string
    url_sm: string
    url_md: string
    url_lg: string
    is_image: boolean
  }
  has_sdd_mandate: boolean
  saldo: 0
  show_almanac: boolean
  show_almanac_addresses: boolean
  show_almanac_phonenumbers: boolean
  show_almanac_email: boolean
  show_almanac_date_of_birth: boolean
  show_almanac_custom_fields: boolean
  custom_fields: Record<string, unknown>
  privacy_policy_accepted: boolean
  send_confirmation_mail: boolean
  payment_required: boolean
  payment_success_uri: string
  payment_start_uri: string
}
async function fetchBirthdayMembers() {
  const time = track()
  // get birthdays
  const body = await fetch("https://api.congressus.nl/v20/members", {
    headers: {
      Authorization: `Bearer:${congressusToken}`,
    },
  }).then(res => res.json() as Promise<CongressusMember[]>)

  const result = body
    .filter(m => m.show_almanac_date_of_birth && IsSameDate(m.date_of_birth))
    .map(m => `${m.first_name} ${m.primary_last_name_prefix} ${m.primary_last_name_main}`)
  logger.debug(time(), "congressus: fetch-all-birthdays")
  return result
}

const birthdayCache: { date: DateTime | null; cache: string[] } = {
  date: null,
  cache: [],
}

export async function getBirthDayMembers() {
  if (birthdayCache.date == null || !IsSameDate(birthdayCache.date)) {
    birthdayCache.cache = await fetchBirthdayMembers()
    birthdayCache.date = DateTime.now()
  }

  return birthdayCache.cache
}

export async function getMemberBirthDate(username: string, retry = 0): Promise<DateTime> {
  try {
    const time = track()
    const res = await fetch(`https://api.congressus.nl/v20/members?username=${username}`, {
      headers: {
        Authorization: `Bearer:${congressusToken}`,
      },
    })
    if (res.ok) {
      const body = (await res.json()) as CongressusMember[]
      if (body.length > 0) {
        if (body[0].show_almanac_date_of_birth) {
          logger.debug(time(), "congressus: fetch-single-birthday")
          return DateTime.fromISO(body[0].date_of_birth)
        } else {
          throw new MyError(ErrorType.PrivateInformation)
        }
      } else {
        logger.error(time(), "congressus member not found")
        throw new MyError(ErrorType.MemberNotFound)
      }
    } else {
      throw { ...new Error("Unexpected error"), httpResponse: res }
    }
  } catch (error) {
    if (error instanceof FetchError) {
      if (retry < 3) {
        return getMemberBirthDate(username, retry + 1)
      } else {
        throw new MyError(ErrorType.CongressusNetworkError)
      }
    } else {
      throw new Error("unexpected error", { cause: error as Error })
    }
  }
}

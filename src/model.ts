import { ErrorType, IsSameDate, MyError } from "./util"
import logger, { track } from "./log"
import fetch, { FetchError, RequestInit } from "node-fetch"
import { DateTime } from "luxon"

const congressusToken = process.env.CONGRESSUS_TOKEN

if (!congressusToken) {
  logger.fatal("No congressus token provided, exiting")
  process.exit(2)
}

export type CongressusMember = {
  id: number
  username: string
  // Status omitted
  gender: string
  initials: string
  nickname: string
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
  email: string
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
  status: {
    id: number
    name: string
    status_id: number
    member_from: `${number}-${number}-${number}`
    member_to: `${number}-${number}-${number}`
    archived: boolean
    deceased: boolean
  }
}

type CongressusPage = {
  has_prev: boolean
  prev_num: number
  has_next: boolean
  next_num: number
  data: CongressusMember[]
  total: number
}

export async function getAllPages(baseUrl: URL, fetchOptions: RequestInit = {}): Promise<CongressusMember[]> {
  const data = []

  let pageNum = 1
  while (true) {
    const url = new URL(baseUrl.toString())
    url.searchParams.set("page", pageNum.toString())
    url.searchParams.set("page_size", "100")
    const firstPage = await fetch(url, { ...fetchOptions })
    const pageData = (await firstPage.json()) as CongressusPage
    data.push(...pageData.data)
    if (pageData.has_next) {
      pageNum = pageData.next_num
    } else {
      break
    }
  }
  return data
}

const memberCache: { lastRefresh: number | null; members: Map<CongressusMember["id"], CongressusMember> } = {
  lastRefresh: null,
  members: new Map<CongressusMember["id"], CongressusMember>(),
}

async function fetchBirthdayMembers() {
  const time = track()
  // get birthdays
  let allMembers
  if (memberCache.lastRefresh == null || memberCache.lastRefresh < Date.now() - 1000 * 60 * 60) {
    allMembers = await getAllPages(new URL("/v30/members", "https://api.congressus.nl"), {
      headers: {
        Authorization: `Bearer: ${congressusToken}`,
      },
    })
    memberCache.lastRefresh = Date.now()
    for (const member of allMembers) {
      memberCache.members.set(member.id, member)
    }
  } else {
    allMembers = [...memberCache.members.values()]
  }

  const result = allMembers
    .filter(
      m =>
        !m.status.archived &&
        !m.status.deceased &&
        m.show_almanac_date_of_birth &&
        m.date_of_birth != null &&
        IsSameDate(m.date_of_birth),
    )
    .map(m =>
      [m.given_name || m.nickname || m.first_name, m.primary_last_name_prefix, m.primary_last_name_main]
        .filter(n => n != null && n !== "")
        .join(" "),
    )
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
    logger.trace({ birthdays: birthdayCache.cache }, "birthday cache miss")
  } else {
    logger.trace({ birthdays: birthdayCache.cache }, "birthday cache hit")
  }

  return birthdayCache.cache
}

export async function getMember(userId: number, retry = 0): Promise<CongressusMember> {
  const time = track()
  let member
  if (
    memberCache.lastRefresh != null &&
    memberCache.lastRefresh > Date.now() - 1000 * 60 * 60 &&
    memberCache.members.has(userId)
  ) {
    member = memberCache.members.get(userId) as CongressusMember
  } else {
    try {
      const res = await fetch(`https://api.congressus.nl/v30/members/${userId}`, {
        headers: {
          Authorization: `Bearer: ${congressusToken}`,
        },
      })
      if (res.ok) {
        member = (await res.json()) as CongressusMember
      } else if (res.status === 404) {
        logger.error(time(), "congressus member not found")
        throw new MyError(ErrorType.MemberNotFound)
      } else {
        throw { ...new Error("Unexpected error"), httpResponse: res }
      }
    } catch (error) {
      if (error instanceof FetchError) {
        if (retry < 3) {
          logger.debug({ retry }, "retrying congressus request")
          return getMember(userId, retry + 1)
        } else {
          throw new MyError(ErrorType.CongressusNetworkError)
        }
      } else {
        throw new Error("unexpected error", { cause: error as Error })
      }
    }
  }
  if (member.show_almanac_date_of_birth) {
    logger.debug(time(), "congressus: fetch-single-birthday")
    return member
  } else {
    throw new MyError(ErrorType.PrivateInformation)
  }
}
export function getMemberBirthDate(userId: number, retry = 0): Promise<DateTime> {
  return getMember(userId, retry).then(m => DateTime.fromISO(m.date_of_birth))
}

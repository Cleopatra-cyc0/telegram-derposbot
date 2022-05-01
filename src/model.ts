import Knex from "knex"
import { IsSameDate } from "./util.js"
import fetch from "node-fetch"

const dbConnctionString = process.env.DB_CONNECTION

if (!dbConnctionString) {
  console.error("No database connection string provided, exiting")
  process.exit(3)
}

const knex = Knex(dbConnctionString)

export function getStatusChats(): Promise<number[]> {
  return getChatsByType(ChatType.Status)
}

export function getBirthdayChats(): Promise<number[]> {
  return getChatsByType(ChatType.Birthday)
}

function getChatsByType(type: ChatType) {
  return knex("chats")
    .where("type", type)
    .select("chat_id")
    .then(rows => rows.map(row => row.chat_id as number))
}

export enum ChatType {
  Status = "status",
  Birthday = "birthday",
}

export async function addBirthdayChat(chatId: number) {
  await knex("chats").insert({
    chat_id: chatId,
    type: ChatType.Birthday,
  })
}

export async function removeBirthdayChat(chatId: number) {
  await knex("chats")
    .where({
      chat_id: chatId,
      type: ChatType.Birthday,
    })
    .delete()
}

const congressusToken = process.env.CONGRESSUS_TOKEN

async function fetchBirthdayMembers() {
  // get birthdays
  const body = await fetch("https://api.congressus.nl/v20/members", {
    headers: {
      Authorization: `Bearer:${congressusToken}`,
    },
  }).then(res => res.json() as Promise<CongressusMember[]>)

  return body
    .filter(m => m.show_almanac_date_of_birth && IsSameDate(m.date_of_birth))
    .map(m => `${m.first_name} ${m.primary_last_name_prefix} ${m.primary_last_name_main}`)
}

const birthdayCache: { date: Date | null; cache: string[] } = {
  date: null,
  cache: [],
}

export async function getBirthDayMembers() {
  if (birthdayCache.date == null || !IsSameDate(birthdayCache.date)) {
    birthdayCache.cache = await fetchBirthdayMembers()
    birthdayCache.date = new Date()
  }

  return birthdayCache.cache
}

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
  custom_fields: {}
  privacy_policy_accepted: boolean
  send_confirmation_mail: boolean
  payment_required: boolean
  payment_success_uri: string
  payment_start_uri: string
}

export async function checkIsAdmin(memberId: number) {
  const res = (await knex("chats").count("*").where({
    chat_id: memberId,
    type: ChatType.Status,
  })) as unknown as { count: number }
  return res.count > 0
}

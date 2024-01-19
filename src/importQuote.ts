// this file is a separate script to import quotes from a downloaded cloetjes file
// it is not used in the main application

import "dotenv/config"
import { CongressusMember, getAllPages } from "./model"
import { readFileSync } from "fs"
import { DateTime } from "luxon"
import dbPromise from "./database"
import User from "./entities/User"
import Quote from "./entities/Quote"

const congressusToken = process.env.CONGRESSUS_TOKEN

if (!congressusToken) {
  console.log("No congressus token provided, exiting")
  process.exit(2)
}

// Change your exported cloetjes file to match this json format
// You can easily convert xlsx to csv to json online!
const cloetjesRaw = readFileSync("./cloetjes.json", "utf-8")
const cloetjes = JSON.parse(cloetjesRaw) as {
  date: string
  name: string
  fico: string
  text: string
}[]

// const allUsersRaw = readFileSync("./allUsers.json", "utf-8")
// const allUsers = JSON.parse(allUsersRaw) as CongressusMember[]

;(async () => {
  const em = (await dbPromise).em.fork()

  let existingUsers = 0
  let newUsers = 0
  let unfoundUsers = 0

  async function createUserForCloe(name: string, congressusId?: number) {
    const firstName = name.split(" ")[0]
    const lastName = name.split(" ").slice(1).join(" ")
    const user = em.create(User, {
      firstName,
      lastName,
      congressusId,
      hasDokNotifications: false,
    })
    await em.persistAndFlush(user)
    newUsers++
    return user.id
  }

  // the below takes a long time, consider downloading once and reading from file
  const allUsers = await getAllPages(new URL("/v30/members", "https://api.congressus.nl"), {
    headers: {
      Authorization: `Bearer: ${congressusToken}`,
    },
  })

  for (const cloe of cloetjes) {
    const date = DateTime.fromFormat(cloe.date, "dd-MM-yyyy hh:mm")

    const member = allUsers.find(u => u.username === cloe.fico)

    let userId: number
    if (!member) {
      unfoundUsers++
      userId = await createUserForCloe(cloe.name)
    } else {
      const existingUser = await em.findOne(User, { congressusId: member.id })
      if (existingUser) {
        existingUsers++
        userId = existingUser.id
      } else {
        userId = await createUserForCloe(cloe.name, member.id)
      }
    }
    const quote = new Quote()
    quote.author = em.getReference(User, userId)
    quote.date = date
    quote.text = cloe.text
    await em.persistAndFlush(quote)
    console.log("saved quote", quote)
  }
  console.log("existing users", existingUsers)
  console.log("new users", newUsers)
  console.log("unfound users", unfoundUsers)
})()

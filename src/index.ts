import { Telegraf } from "telegraf"
import { CronJob } from "cron"

const telegramToken = process.env.TG_TOKEN
const congressusToken = process.env.CONGRESSUS_TOKEN
const telegramChatId = process.env.TG_CHAT_ID

if (!telegramToken) {
  console.error("No telegram token provided, exiting")
  process.exit(1)
}

if (!congressusToken) {
  console.error("No congressus token provided, exiting")
  process.exit(2)
}

if (!telegramChatId) {
  console.error("No telegram chat id provided, exiting")
  process.exit(3)
}

const bot = new Telegraf(telegramToken)
// const job = new CronJob("5 0 * * *", () => {
//   bot.telegram.sendMessage(telegramChatId, "Hi there")
// })
bot.telegram.sendMessage(telegramChatId, "Hi there")

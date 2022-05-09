import { Telegraf } from "telegraf"
import { MyContext } from ".."
import User from "../entities/User"
import { v4 as uuid4 } from "uuid"
import logger from "../log"

const congressusDomain = process.env.CONGRESSUS_DOMAIN
const congressusClientId = process.env.CONGRESSUS_CLIENT_ID

if (!congressusDomain) {
  logger.fatal("No congressus domain provided, exiting")
  process.exit(4)
}
if (!congressusClientId) {
  logger.fatal("No congressus client id provided, exiting")
  process.exit(5)
}

/**
 * Commands that deal with the connection between congressus and telegram
 * @param bot the telegraf instance to add the commands to
 */
export function connectCommands(bot: Telegraf<MyContext>) {
  bot.command("connect", async ctx => {
    const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
    user.congresssusOauthState = uuid4()
    ctx.db.persist(user)
    const link = `${congressusDomain}/oauth/authorize?response_type=code&client_id=${congressusClientId}&scope=openid&state=${user.congresssusOauthState}`

    ctx.reply(`Click on [this link](${link}) and log in to congressus to connect your acocunt`, {
      parse_mode: "MarkdownV2",
    })
  })
}

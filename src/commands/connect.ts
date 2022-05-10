import { Telegraf } from "telegraf"
import { MyKoaContext, MyTelegrafContext } from ".."
import User from "../entities/User"
import { v4 as uuid4 } from "uuid"
import logger from "../log"
import fetch from "node-fetch"

const congressusDomain = process.env.CONGRESSUS_DOMAIN
const congressusClientId = process.env.CONGRESSUS_CLIENT_ID
const congressusClientSecret = process.env.CONGRESSUS_CLIENT_SECRET

if (!congressusDomain) {
  logger.fatal("No congressus domain provided, exiting")
  process.exit(4)
}
if (!congressusClientId) {
  logger.fatal("No congressus client id provided, exiting")
  process.exit(5)
}
if (!congressusClientSecret) {
  logger.fatal("No congressus client secret provided, exiting")
  process.exit(5)
}

/**
 * Commands that deal with the connection between congressus and telegram
 * @param bot the telegraf instance to add the commands to
 */
export function connectCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.command("connect", async ctx => {
    if (ctx.chat.type === "private") {
      const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
      user.congresssusOauthState = uuid4()
      ctx.db.persist(user)
      const link = `${congressusDomain}/oauth/authorize?response_type=code&client_id=${congressusClientId}&scope=openid&state=${user.congresssusOauthState}`

      ctx.reply(`Click on [this link](${link}) and log in to congressus to connect your acocunt`, {
        parse_mode: "MarkdownV2",
      })
    } else {
      ctx.reply("moet je even prive doen piepo")
    }
  })

  bot.command("disconnect", async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    if (user != null) {
      if (user.congressusId) {
        user.congressusId = undefined
        ctx.db.persist(user)
        ctx.reply("k")
      } else {
        ctx.reply("Jou had ik nog niet hoor")
      }
    } else {
      ctx.reply("wie ben jij?")
    }
  })
}

export async function congressusOAuthHandler(ctx: MyKoaContext) {
  const code = ctx.query["code"]
  const state = ctx.query["state"]
  const user = await ctx.db.findOne(User, { congresssusOauthState: state })
  if (user != null) {
    const res = await fetch(`${congressusDomain}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(congressusClientId + ":" + congressusClientSecret).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=authorization_code&code=${code}`,
    })
    if (res.ok) {
      const body = await res.json()
      if ((await ctx.db.count(User, { congressusId: body.userId })) === 0) {
        user.congressusId = body.user_id
        user.congresssusOauthState = undefined
        ctx.db.persist(user)
        logger.info({ user }, "user succes")
        ctx.res.write("Ja mooi man")
        ctx.status = 200
        ctx.res.end()
      } else {
        ctx.res.write("jou kende ik al")
        ctx.status = 403
        ctx.res.end()
      }
    } else {
      const body = await res.text()
      logger.error({ error: res.status, body }, "oauth return fetch error")
      ctx.res.write("ging iets mis bij congressus")
      ctx.status = 500
      ctx.res.end()
    }
  } else {
    logger.error({ state }, "invalid state given in OAuth flow")
    ctx.res.write("Dat mag niet")
    ctx.status = 403
    ctx.res.end()
  }
}

import { Telegraf } from "telegraf"
import { MyKoaContext, MyTelegrafContext } from ".."
import User from "../entities/User"
import { v4 as uuid4 } from "uuid"
import logger from "../log"
import fetch from "node-fetch"
import { URL } from "node:url"
import { BotCommandScope, registerCommand } from "./commandlist"

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

const oAuthStateStore: Map<ReturnType<typeof uuid4>, User["telegramId"]> = new Map()

/**
 * Commands that deal with the connection between congressus and telegram
 * @param bot the telegraf instance to add the commands to
 */
export function userCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.use(async (ctx, next) => {
    if (ctx.message?.from?.id != null && ctx.chat?.type === "private") {
      const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
      user.telegramPrivateChatId = ctx.chat.id
      ctx.db.persist(user)
    }
    await next()
  })
  registerCommand("connect", "verbind congressus met telegram", BotCommandScope.Private)
  bot.command("connect", async ctx => {
    if (ctx.chat.type === "private") {
      const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
      const oAuthState = uuid4()
      oAuthStateStore.set(oAuthState, user.telegramId)
      ctx.db.persist(user)
      const url = new URL("/oauth/authorize", congressusDomain)
      url.searchParams.set("response_type", "code")
      url.searchParams.set("client_id", congressusClientId as string)
      url.searchParams.set("scope", "openid")
      url.searchParams.set("state", oAuthState)

      ctx.reply(`Click on [this link](${url.toString()}) and log in to congressus to connect your acocunt`, {
        parse_mode: "MarkdownV2",
      })
    } else {
      ctx.reply(`moet je even prive doen piepo: https://t.me/${ctx.botInfo?.username}`)
    }
  })

  registerCommand("disconnect", "verwijder je verbinding tussen congressus en telegram", BotCommandScope.Private)
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
  const userId = oAuthStateStore.get(state as string)

  if (userId != null) {
    oAuthStateStore.delete(state as string)
    const telegramUser = await ctx.db.findOne(User, { telegramId: userId })
    if (telegramUser != null) {
      const res = await fetch(`${congressusDomain}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(congressusClientId + ":" + congressusClientSecret).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=authorization_code&code=${code}`,
      })
      if (res.ok) {
        const body = (await res.json()) as { user_id: number }
        const existingCongressusUser = await ctx.db.findOne(User, { congressusId: body.user_id })
        if (existingCongressusUser == null) {
          telegramUser.congressusId = body.user_id
          ctx.db.persist(telegramUser)
          logger.info({ user: telegramUser }, "user succes")
          ctx.res.write("Ja mooi man")
          ctx.status = 200
          ctx.res.end()
        } else if (existingCongressusUser.id != telegramUser.id) {
          if (existingCongressusUser.telegramId == null) {
            await ctx.db.getRepository(User).mergeUsers(existingCongressusUser.id, telegramUser.id)
            ctx.res.write("Ja mooi man")
            ctx.status = 200
            ctx.res.end()
          } else {
            logger.info(
              { congressusBody: body, user: telegramUser },
              "duplicate telegram account to congressus account",
            )
            ctx.res.write("dat ben jij niet")
            ctx.status = 403
            ctx.res.end()
          }
        } else {
          logger.trace({ congressusBody: body, user: telegramUser }, "congressus reconnect to same telegram")
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
      logger.error({ userId }, "invalid userId retrieved from oAuthStateStore")
      ctx.res.write("Ging wat goed mis")
      ctx.status = 500
      ctx.res.end()
    }
  } else {
    logger.error({ state, oAuthStateStore: [...oAuthStateStore.entries()] }, "invalid state given in OAuth flow")
    ctx.res.write("Dat mag niet")
    ctx.status = 403
    ctx.res.end()
  }
}

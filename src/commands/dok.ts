import fetch from "node-fetch"
import { Telegraf } from "telegraf"
import { MyKoaContext, MyTelegrafContext } from ".."
import User from "../entities/User"
import logger from "../log"
import { registerCommand } from "./commandlist"

export default function dokCommands(bot: Telegraf<MyTelegrafContext>) {
  const dokApiSecret = process.env.DOK_SECRET
  if (!dokApiSecret) {
    logger.fatal("No dok secret provided, exiting")
    process.exit(8)
  }

  registerCommand("dok", "check hoeveel dok je nog hebt")
  bot.command("dok", async ctx => {
    if (ctx.chat.type === "private") {
      const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
      if (user != null && user.congressusId != null) {
        const url = new URL("https://api.cleopatra-groningen.nl/api/dok_information")
        url.searchParams.set("congressus_user_id", user.congressusId.toString())
        url.searchParams.set("secret", dokApiSecret)
        const res = await fetch(url, {
          method: "GET",
        })
        if (res.ok) {
          const body = (await res.json()) as { status: string; data: { used_dok: number; dok_limit: number } }
          if (body.data.dok_limit > 0) {
            const percent = body.data.used_dok / body.data.dok_limit
            const suffix =
              percent < 0.1
                ? "Harder zuipen"
                : percent < 0.3
                ? "Dat kan wel wel wat harder nog"
                : percent < 0.5
                ? "Nog niet op de helft"
                : percent < 0.7
                ? "De sweet spot"
                : percent < 0.9
                ? "Nou kom je in de gevarenzone"
                : percent < 0.96
                ? "Geniet maar van die laatste"
                : "Op is op, had je maar meer dok moeten hebben"
            await ctx.reply(
              `Je hebt €${body.data.used_dok / 100} van €${body.data.dok_limit / 100} gebruikt, ${suffix}`,
            )
          } else {
            await ctx.reply("Je hebt helemaal geen dok pikketrekker")
          }
        } else {
          logger.error({ response: res }, "error while fetching dok info")
          await ctx.reply("Ging iets mis")
        }
      } else {
        await ctx.reply("Ik ken jou niet, gebruik /connect eerst")
      }
    } else {
      await ctx.reply("Moet prive")
    }
  })

  registerCommand("ikwilmndokhoren", "Krijg een bericht wanneer er op je gedokt wordt")
  bot.command("ikwilmndokhoren", async ctx => {
    if (ctx.message.chat.type === "private") {
      const user = (await ctx.db.findOne(User, { telegramId: ctx.message.from.id })) as User
      if (user.congressusId != null) {
        if (!user.hasDokNotifications) {
          user.hasDokNotifications = true
          ctx.db.persist(user)
          await ctx.reply("Joe")
        } else {
          await ctx.reply("Had je al grappenmaker")
        }
      } else {
        await ctx.reply("Je moet eerst connecten")
      }
    } else {
      await ctx.reply("Kan alleen prive")
    }
  })

  registerCommand("kappenmetdok", "stop met het ontvangen van berichten van je dok")
  bot.command("kappenmetdok", async ctx => {
    if (ctx.message.chat.type === "private") {
      const user = (await ctx.db.findOne(User, { telegramId: ctx.message.from.id })) as User
      if (user.hasDokNotifications) {
        user.hasDokNotifications = false
        ctx.db.persist(user)
        await ctx.reply("Joe")
      } else {
        await ctx.reply("Had je al niet grappenmaker")
      }
    } else {
      await ctx.reply("Kan alleen prive")
    }
  })
}

export async function dokHandler(ctx: MyKoaContext) {
  logger.info({ request: ctx.request }, "dok call")

  const body = ctx.request.body as undefined | DokNotificationPayload
  if (body) {
    const user = await ctx.db.findOne(User, { congressusId: body?.congressus_user_id })

    if (user && user.hasDokNotifications) {
      let message = `Er is net op je gedokt voor €${(body?.total_amount / 100).toFixed(2)}:`
      for (const product of body.products) {
        message += `\n- ${product.quantity} ${product.product} voor: €${(product.price / 100).toFixed(2)}`
      }
      const chatId = user.telegramPrivateChatId ?? user.telegramId
      try {
        await ctx.telegram.sendMessage(chatId, message)
        ctx.res.statusCode = 201
        logger.trace({ user, dokInfo: body }, "Sent dok notification")
      } catch (error) {
        ctx.res.statusCode = 500
        logger.error({ error }, "Error sending DOK notification")
      }
    } else {
      ctx.res.statusCode = 200
      logger.trace({ user, dokInfo: body }, "Received dok notifiaction for unsubscribed user")
    }
  } else {
    ctx.res.statusCode = 400
    logger.error("Invalid DOK notification webhook request")
  }

  ctx.res.end()
}

type DokNotificationPayload = {
  congressus_user_id: number
  total_amount: number
  products: [{ product: "Bier"; quantity: number; price: number }]
}

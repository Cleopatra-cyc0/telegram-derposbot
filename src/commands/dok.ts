import fetch from "node-fetch"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import User from "../entities/User"
import logger from "../log"

export default function dokCommands(bot: Telegraf<MyTelegrafContext>) {
  const dokApiSecret = process.env.DOK_SECRET
  if (!dokApiSecret) {
    logger.fatal("No dok secret provided, exiting")
    process.exit(8)
  }

  bot.command("dok", async ctx => {
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
          await ctx.reply(`Je hebt €${body.data.used_dok / 100} van €${body.data.dok_limit / 100} gebruikt, ${suffix}`)
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
  })
}

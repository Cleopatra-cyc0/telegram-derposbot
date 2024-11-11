import { EntityManager } from "@mikro-orm/postgresql"
import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import Quote from "../entities/Quote"
import User from "../entities/User"
import logger from "../log"
import { getMember } from "../model"
import { checkAndInsertRateLimit } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"

export default function quoteCommands(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("cloetje", "geef me een cloetje", [BotCommandScope.Private, BotCommandScope.Admins])
  bot.command("cloetje", async ctx => {
    if (ctx.chat.type === "private") {
      if (checkAndInsertRateLimit(`quote${ctx.chat.id}`, 1, 1000 * 60 * 60 * 24)) {
        const message = await getCloeMessage(ctx.db)
        await ctx.reply(message)
      } else {
        logger.trace({ userId: ctx.message.from.id, chatId: ctx.chat.id }, "cloe rate limited")
        await ctx.replyWithPhoto("https://i.ibb.co/KX0v39J/cleo-leus.png")
      }
    } else {
      await ctx.reply("alleen prive")
    }
  })

  registerCommand("cloe", "een nieuw cloetje opslaan!", [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command("cloe", async ctx => {
    const text: string = ctx.message.text.split(" ").slice(1).join(" ").trim()
    const user: User = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)

    if (text == "") {
        await ctx.reply("je hebt geen cloetje meegestuurd, dumbass.")
    } else {
        const quote = new Quote()
        quote.text = text
        quote.author = user
        ctx.db.persist(quote)
        await ctx.reply("cloe opgeslagen")
    }
  })
}

async function getCloeMessage(db: EntityManager) {
  const [cloetje] = await db
    .createQueryBuilder(Quote, "q")
    .orderBy({ ["RANDOM()"]: "ASC" })
    .limit(1)
    .joinAndSelect("q.author", "a")
    .getResultList()
  if (cloetje) {
    const member = cloetje.author.congressusId
      ? await getMember(cloetje.author.congressusId).catch(error => {
          logger.error(
            {
              error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
              memberId: cloetje.author.congressusId,
            },
            "error fetching cloe author member",
          )
          return null
        })
      : null

    const indiener = member
      ? `${member.given_name ?? member.first_name}${member.primary_last_name_prefix ? ` ${member.primary_last_name_prefix}` : ""} ${
          member.primary_last_name_main
        }`
      : "onbekend"

    return `${cloetje.text}\n\ningediend op ${cloetje.date.toLocaleString(DateTime.DATETIME_MED)} door ${indiener}`
  } else {
    logger.trace("no cloetjes found")
    return "Geen cloetjes gevonden"
  }
}

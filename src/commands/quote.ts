import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import Quote from "../entities/Quote"
import logger from "../log"
import { getMember } from "../model"
import { checkAndInsertRateLimit } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"

export default function quoteCommands(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("cloetje", "geef me een cloetje", [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command("cloetje", async ctx => {
    if (checkAndInsertRateLimit(`quote${ctx.chat.id}`, 3, 1000 * 60 * 5)) {
      const [cloetje] = await ctx.db
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
                "error fetching member",
              )
              return null
            })
          : null

        const indiener = member
          ? `${member.first_name}${member.primary_last_name_prefix ? ` ${member.primary_last_name_prefix}` : ""} ${
              member.primary_last_name_main
            }`
          : "onbekend"

        await ctx.reply(
          `${cloetje.text}\n\ningediend op ${cloetje.date.toLocaleString(DateTime.DATETIME_MED)} door ${indiener}`,
        )
      } else {
        logger.trace("no cloetjes found")
        await ctx.reply("Geen cloetjes gevonden")
      }
    } else {
      logger.trace({ userId: ctx.message.from.id, chatId: ctx.chat.id }, "cloe rate limited")
      await ctx.reply("ff rustig")
    }
  })
}

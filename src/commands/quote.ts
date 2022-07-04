import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import Quote from "../entities/Quote"
import { getMember } from "../model"

export default function quoteCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.command("cloetje", async ctx => {
    const [cloetje] = await ctx.db
      .createQueryBuilder(Quote, "q")
      .orderBy({ ["RANDOM()"]: "ASC" })
      .limit(1)
      .joinAndSelect("q.author", "a")
      .getResultList()
    const member = cloetje.author.congressusId ? await getMember(cloetje.author.congressusId) : null

    if (member) {
      await ctx.reply(
        `${cloetje.text}\n\n - ${member.first_name}${
          member.primary_last_name_prefix ? ` ${member.primary_last_name_prefix}` : ""
        } ${member.primary_last_name_main}`,
      )
    } else {
      await ctx.reply(`${cloetje.text}\n\n - onbekend`)
    }
  })
}

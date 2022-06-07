import { Telegraf } from "telegraf"
import { MyTelegrafContext } from "../index.js"
import logger from "../log.js"
import ChatSubscription, { SubScriptionType } from "../entities/ChatSubscription.js"
import { enumKeys } from "../util.js"
import { BotCommandScope, registerCommand } from "./commandlist.js"

export default function subscriptionCommands(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("subscribe", `Subscribe voor een type notification (${Object.values(SubScriptionType).join(", ")})`, [
    BotCommandScope.Private,
    BotCommandScope.Admins,
  ])
  bot.command("subscribe", async ctx => {
    const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
    let type: SubScriptionType | null = null
    for (const key of enumKeys(SubScriptionType)) {
      if (typeRaw === SubScriptionType[key]) {
        type = typeRaw
        break
      }
    }
    type = type ?? SubScriptionType.Birthday
    if (
      ctx.chat.type === "private" ||
      ["administrator", "creator"].includes((await ctx.getChatMember(ctx.from.id)).status)
    ) {
      if ((await ctx.db.count(ChatSubscription, { telegramChatId: ctx.chat.id.toString(), type })) === 0) {
        const sub = new ChatSubscription(ctx.chat.id.toString(), type)
        ctx.db.persist(sub)
        ctx.reply(`Ja prima${type === SubScriptionType.Birthday ? ", je hoort het om 00:05" : ""}`)
        logger.info(
          {
            chatId: ctx.chat.id,
            type,
            chatName: ctx.chat.type === "private" ? `${ctx.from.first_name} ${ctx.from.last_name}` : ctx.chat.title,
          },
          "register subscription",
        )
      } else {
        ctx.reply("Was al")
      }
    } else {
      ctx.reply("mag niet")
    }
  })

  registerCommand(
    "unsubscribe",
    `Unsubscribe voor een type notification (${Object.values(SubScriptionType).join(", ")})`,
    [BotCommandScope.Private, BotCommandScope.Admins],
  )
  bot.command("unsubscribe", async ctx => {
    const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
    let type: SubScriptionType | null = null
    for (const key of enumKeys(SubScriptionType)) {
      if (typeRaw === SubScriptionType[key]) {
        type = typeRaw
        break
      }
    }
    type = type ?? SubScriptionType.Birthday
    if (
      ctx.chat.type === "private" ||
      ["administrator", "creator"].includes((await ctx.getChatMember(ctx.from.id)).status)
    ) {
      const sub = await ctx.db.findOne(ChatSubscription, { type, telegramChatId: ctx.chat.id.toString() })
      if (sub != null) {
        ctx.db.remove(sub)
        logger.info(
          {
            chatId: ctx.chat.id,
            type,
            chatName: ctx.chat.type === "private" ? `${ctx.from.first_name} ${ctx.from.last_name}` : ctx.chat.title,
          },
          "remove subscription",
        )
        await ctx.reply("joe")
      } else {
        await ctx.reply("Was al niet joh")
      }
    } else {
      await ctx.reply("mag niet")
    }
  })
}

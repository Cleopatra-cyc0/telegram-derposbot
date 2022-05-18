import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import TelegrafStatelessQuestion from "telegraf-stateless-question/dist/source"
import { MyTelegrafContext } from ".."
import { MessageTask } from "../entities/Task"
import logger from "../log"
import { getRandomInRange, stringInEnum } from "../util"

const announcementApprovalChatId = parseInt(process.env.ANNOUNCEMENT_APPROVAL_CHAT_ID ?? "")
const announcementChatId = parseInt(process.env.ANNOUNCEMENT_CHAT_ID ?? "")

if (isNaN(announcementApprovalChatId)) {
  logger.fatal("Invalid announcement approval chat id provided, exiting")
  process.exit(6)
}
if (isNaN(announcementChatId)) {
  logger.fatal("Invalid announcement chat id provided, exiting")
  process.exit(7)
}

enum AnnouncementReply {
  Approve = "approve",
  Decline = "decline",
}

const constructInlineKeyboard = (messageId: number) => [
  [
    {
      text: "Ja",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Approve, messageId])}`,
    },
    {
      text: "Nee",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Decline, messageId])}`,
    },
  ],
]

const announcementQuestion = new TelegrafStatelessQuestion<MyTelegrafContext>("Stuur nu je mededeling", async ctx => {
  if (ctx.chat != null) {
    const forwardedMessage = await ctx.forwardMessage(announcementApprovalChatId)
    await ctx.telegram.sendMessage(announcementApprovalChatId, "Goedkeuren?", {
      reply_to_message_id: forwardedMessage.message_id,
      reply_markup: {
        inline_keyboard: constructInlineKeyboard(forwardedMessage.message_id),
      },
    })
    await ctx.reply("Joe, ligt klaar voor goedkeuring", { reply_markup: { remove_keyboard: true } })

    const reportSeenMessageTask = new MessageTask(
      DateTime.now().plus({ minutes: getRandomInRange(5, 20, 0) }),
      ctx.chat.id,
      "Bestuur heef je bericht gezien en is er mee bezig",
    )
    ctx.db.persist(reportSeenMessageTask)
  } else {
    logger.error({ message: ctx.message }, "Received message without chat attached")
    await ctx.reply("Er gaat nu wel iets raars mis hoor, sorry")
  }
})

export default function announcementCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.use(announcementQuestion.middleware())
  bot.command("mededeling", async ctx => {
    if (ctx.chat.type === "private") {
      await announcementQuestion.replyWithMarkdown(ctx, "Stuur nu je mededeling")
    } else {
      ctx.reply(`werkt alleen prive: https://t.me/${ctx.botInfo?.username}`)
    }
  })

  const callbacksProcessing = new Set<string>()
  bot.on("callback_query", async (ctx, next) => {
    if (
      ctx.callbackQuery.data != null &&
      ctx.callbackQuery.data.startsWith("APR") &&
      !callbacksProcessing.has(ctx.callbackQuery.data)
    ) {
      callbacksProcessing.add(ctx.callbackQuery.data)
      const jsonStr = ctx.callbackQuery.data.slice(4)
      const callbackData = JSON.parse(jsonStr)
      const [action, messageId] = callbackData
      if (stringInEnum(action, AnnouncementReply)) {
        await ctx.deleteMessage()
        if (action === AnnouncementReply.Approve) {
          await ctx.telegram.copyMessage(announcementChatId, announcementApprovalChatId, messageId)
        } else if (action === AnnouncementReply.Decline) {
          await ctx.deleteMessage(messageId)
        }
      } else {
        logger.error({ callbackQuery: ctx.callbackQuery }, "invalid announcement callback data")
      }
      callbacksProcessing.delete(ctx.callbackQuery.data)
    } else {
      await next()
    }
  })
}

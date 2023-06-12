import { EntityManager } from "@mikro-orm/postgresql"
import { DateTime } from "luxon"
import { Telegraf, Telegram } from "telegraf"
import TelegrafStatelessQuestion from "telegraf-stateless-question/dist/source"
import { InlineKeyboardButton, Message } from "telegraf/typings/core/types/typegram"
import { MyTelegrafContext } from ".."
import { DeleteMessageTask, ForwardMessageTask, MessageTask, Task } from "../entities/Task"
import logger from "../log"
import { getRandomInRange, isMemberOfEnum } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"

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
  Approve,
  Decline,
  Schedule,

  ScheduleAnswer,

  ScheduleOptionCancel,

  ScheduleCancel,

  ScheduleCustomTime,
  ScheduleCustomTimeCancel,
}

const constructInitialInlineKeyboard = (messageId: number) => [
  [
    {
      text: "Ja",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Approve, messageId])}`,
    },
    {
      text: "Later",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Schedule, messageId])}`,
    },
  ],
  [
    {
      text: "Nee",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Decline, messageId])}`,
    },
  ],
]

const constructScheduleInlineKeyboard = (messageId: number, now: DateTime) => {
  const options = [1, 2, 4, 8, 24, 48]
    .map(h => now.plus({ hours: h }))
    .map(t => ({
      text: t.toLocaleString(DateTime.DATETIME_SHORT),
      callback_data: `APR-${JSON.stringify([AnnouncementReply.ScheduleAnswer, messageId, t.toMillis()])}`,
    }))
  const optionRows: InlineKeyboardButton[][] = [
    [
      {
        text: "Toch niet",
        callback_data: `APR-${JSON.stringify([AnnouncementReply.ScheduleOptionCancel, messageId])}`,
      },
    ],
    ...options.reduce<InlineKeyboardButton[][]>(
      (rows, opt) => {
        const precedingRows = rows.slice(0, rows.length - 1)
        const lastRow = rows[rows.length - 1]
        if (lastRow.length < 3) {
          return [...precedingRows, [...lastRow, opt]]
        } else {
          return [...rows, [opt]]
        }
      },
      [[]],
    ),
    [
      {
        text: "Vul datum in",
        callback_data: `APR-${JSON.stringify([AnnouncementReply.ScheduleCustomTime, messageId])}`,
      },
    ],
  ]
  return optionRows
}

const constructCustomScheduleInlineKeyboard = (messageId: number) => [
  [
    {
      text: "Toch niet",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.ScheduleCustomTimeCancel, messageId])}`,
    },
  ],
]

const announcementQuestion = new TelegrafStatelessQuestion<MyTelegrafContext>("Stuur nu je mededeling", async ctx => {
  if (ctx.chat != null) {
    const messageText = (ctx.message as Message & { text: string }).text
    logger.trace({ from: ctx.message.from.id, text: messageText }, `Got new announcement request`)
    const forwardedMessage = await ctx.forwardMessage(announcementApprovalChatId)
    await ctx.telegram.sendMessage(announcementApprovalChatId, "Goedkeuren?", {
      reply_to_message_id: forwardedMessage.message_id,
      reply_markup: {
        inline_keyboard: constructInitialInlineKeyboard(forwardedMessage.message_id),
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

type AnnouncementCustomScheduleQuestionAdditionalState = {
  announcementMessageId: MessageIdentifier
  statusMessageId: MessageIdentifier
}

const announcementCustomSchedulequestion = new TelegrafStatelessQuestion<MyTelegrafContext>(
  "Okehoelaat",
  async (ctx, additionalState: string) => {
    logger.debug("Custom schedule answer!")
    const messageText = (ctx.message as Message & { text: string }).text
    const date = DateTime.fromISO(messageText)
    const additional = JSON.parse(additionalState) as AnnouncementCustomScheduleQuestionAdditionalState
    if (!date.isValid || date < DateTime.now()) {
      await ctx.reply(!date.isValid ? "Kan de datum niet begrijpen zo hoor" : "Kan geen datum in het verleden zijn")
      await ctx.telegram.editMessageReplyMarkup(
        additional.statusMessageId.chatId,
        additional.statusMessageId.messageId,
        undefined,
        {
          inline_keyboard: constructInitialInlineKeyboard(additional.announcementMessageId.messageId),
        },
      )
    } else {
      await scheduleSend(ctx.telegram, ctx.db, additional.announcementMessageId, date, additional.statusMessageId)
    }
  },
)

type MessageIdentifier = {
  chatId: number
  messageId: number
}

async function scheduleSend(
  telegram: Telegram,
  db: EntityManager,
  announcementMessageId: MessageIdentifier,
  sendDate: DateTime,
  statusMessageId: MessageIdentifier,
) {
  const scheduledAnnouncementTask = new ForwardMessageTask(
    sendDate,
    announcementMessageId.chatId,
    announcementMessageId.messageId,
    announcementChatId,
    true,
  )
  const deleteApprovalMessageTask = new DeleteMessageTask(sendDate, statusMessageId.chatId, statusMessageId.messageId)
  await db.persist([scheduledAnnouncementTask, deleteApprovalMessageTask]).flush()

  await telegram.editMessageText(
    statusMessageId.chatId,
    statusMessageId.messageId,
    undefined,
    `Gaat om ${sendDate.toLocaleString(DateTime.TIME_24_SIMPLE)}`,
  )
  await telegram.editMessageReplyMarkup(statusMessageId.chatId, statusMessageId.messageId, undefined, {
    inline_keyboard: [
      [
        {
          text: "Annuleer",
          callback_data: `APR-${JSON.stringify([
            AnnouncementReply.ScheduleCancel,
            announcementMessageId,
            [scheduledAnnouncementTask.id, deleteApprovalMessageTask.id],
          ])}`,
        },
      ],
    ],
  })
}

export default function announcementCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.use(announcementQuestion.middleware())
  bot.use(announcementCustomSchedulequestion.middleware())
  registerCommand("mededeling", "Stuur een mededeling naar bestuur", BotCommandScope.Private)
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
      const [action, messageId, extraPayload] = callbackData as [
        AnnouncementReply,
        number,
        number | [number, number] | undefined,
      ]
      if (isMemberOfEnum(action, AnnouncementReply)) {
        if (action === AnnouncementReply.Approve) {
          await ctx.deleteMessage()
          await ctx.telegram.copyMessage(announcementChatId, announcementApprovalChatId, messageId)
        } else if (action === AnnouncementReply.Decline) {
          await ctx.deleteMessage()
          await ctx.deleteMessage(messageId)
        } else if (action === AnnouncementReply.Schedule) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructScheduleInlineKeyboard(messageId, DateTime.now()),
          })
        } else if (action === AnnouncementReply.ScheduleAnswer && typeof extraPayload === "number") {
          const dateToSend = DateTime.fromMillis(extraPayload)
          const announcementMessageId: MessageIdentifier = {
            chatId: announcementApprovalChatId,
            messageId,
          }
          if (!ctx.chat || !ctx.callbackQuery.message) {
            logger.error("Weird state in callback query, no chat or message attached")
            await ctx.reply("It's gone wrong...")
            return
          }
          const statusMessageId: MessageIdentifier = {
            chatId: ctx.chat.id,
            messageId: ctx.callbackQuery.message.message_id,
          }
          await scheduleSend(ctx.telegram, ctx.db, announcementMessageId, dateToSend, statusMessageId)
        } else if (action === AnnouncementReply.ScheduleCustomTime) {
          if (!ctx.chat || !ctx.callbackQuery.message) {
            logger.error("Weird state in callback query, no chat or message attached")
            await ctx.reply("It's gone wrong...")
            return
          }
          const additionalState: AnnouncementCustomScheduleQuestionAdditionalState = {
            announcementMessageId: { chatId: announcementApprovalChatId, messageId },
            statusMessageId: {
              chatId: ctx.chat.id,
              messageId: ctx.callbackQuery.message.message_id,
            },
          }
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructCustomScheduleInlineKeyboard(messageId),
          })
          await announcementCustomSchedulequestion.replyWithMarkdown(
            ctx,
            "Oke, hoelaat? (ISO 8601 standaard)",
            JSON.stringify(additionalState),
          )
        } else if (action === AnnouncementReply.ScheduleOptionCancel) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructInitialInlineKeyboard(messageId),
          })
        } else if (action === AnnouncementReply.ScheduleCancel && Array.isArray(extraPayload)) {
          const task = await ctx.db.find(Task, { id: { $in: extraPayload } })

          ctx.db.remove(task)

          ctx.editMessageReplyMarkup({ inline_keyboard: constructInitialInlineKeyboard(messageId) })
        } else if (action === AnnouncementReply.ScheduleCustomTimeCancel) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructScheduleInlineKeyboard(messageId, DateTime.now()),
          })
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

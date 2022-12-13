import { Configuration, OpenAIApi } from "openai"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import logger from "../log"
import { checkAndInsertRateLimit } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG,
})

const openai = new OpenAIApi(config)
const superAdminUserId = parseInt(process.env.SUPER_ADMIN_USER_ID as string)
export default function chatGpt(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("chat", "praat met de bot (engels)", [BotCommandScope.Private, BotCommandScope.Groups])
  bot.command("chat", async ctx => {
    if (checkAndInsertRateLimit(`chat ${ctx.from.id}`, 1, 60 * 60 * 1000) || ctx.from.id === superAdminUserId) {
      try {
        const { data } = await openai.createCompletion({
          model: "babbage",
          prompt: ctx.message.text.split(" ").slice(1).join(" "),
          temperature: 0.5,
          best_of: 1,
        })
        if (data.choices.length > 0 && data.choices[0].text != null) {
          ctx.reply(data.choices[0].text)
        } else {
          throw new Error("No response from openapi")
        }
      } catch (e) {
        logger.error(e, "Error in chatgpt")
        ctx.reply("Something went wrong")
      }
    } else {
      ctx.reply(
        `Omdat dit centjes kost mag je maar 1 keer per uur.\
Vraag anders aan bestuur of ze willen betalen (kost *bijna* niks)`,
      )
    }
  })
}

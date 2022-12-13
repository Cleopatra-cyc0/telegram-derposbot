import { Configuration, OpenAIApi } from "openai"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import logger from "../log"
import { BotCommandScope, registerCommand } from "./commandlist"
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG,
})

const openai = new OpenAIApi(config)

export default function chatGpt(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("chat", "praat met de bot (engels)", [BotCommandScope.Private, BotCommandScope.Groups])
  bot.command("chat", async ctx => {
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
  })
}

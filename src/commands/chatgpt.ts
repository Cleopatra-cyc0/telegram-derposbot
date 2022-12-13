import { Configuration, OpenAIApi } from "openai"
import { Middleware, Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import { BotCommandScope, registerCommand } from "./commandlist"
const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG,
})

const openai = new OpenAIApi(config)

export default function chatGpt(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("chat", "praat met de bot (engels)", [BotCommandScope.Private, BotCommandScope.Groups])
  const chatCommand = async (ctx: MyTelegrafContext & { from: { id: number } | undefined }) => {
    const { data } = await openai.createCompletion({
      model: "babbage",
      prompt: "This is a test",
      temperature: 0.9,
      best_of: 1,
      user: `telegram user: ${ctx.from?.id.toString()}`,
    })
    if (data.choices.length > 0 && data.choices[0].text != null) {
      ctx.reply(data.choices[0].text)
    } else {
      ctx.reply("Something went wrong")
    }
  }
  bot.command("chat", chatCommand)
  if (bot.botInfo != null) {
    bot.mention(bot.botInfo.username, chatCommand)
  }
}

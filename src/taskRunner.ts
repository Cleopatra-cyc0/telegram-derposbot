import { CronJob } from "cron"
import { DateTime } from "luxon"
import { Telegram } from "telegraf"
import MikroOrm from "./database"
import { Task } from "./entities/Task"

export function startTaskRunner(telegram: Telegram) {
  const taskJob = new CronJob("*/1 * * * * *", async () => {
    const db = (await MikroOrm).em.fork().getRepository(Task)
    const tasks = await db.find({ done: false })
    const tasksToRun = tasks.filter(task => task.isEligibeToRun(DateTime.now()))
    await Promise.all(tasksToRun.map(t => t.run(telegram)))
  })
  return () => taskJob.stop()
}

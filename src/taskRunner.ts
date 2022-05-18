import { CronJob } from "cron"
import { DateTime } from "luxon"
import { Telegram } from "telegraf"
import MikroOrm from "./database"
import { Task } from "./entities/Task"
import logger from "./log"

export function startTaskRunner(telegram: Telegram) {
  const taskJob = new CronJob("*/1 * * * *", async () => {
    const db = (await MikroOrm).em.fork().getRepository(Task)
    const tasks = await db.find({ done: false })
    const tasksToRun = tasks.filter(task => task.isEligibeToRun(DateTime.now()))
    try {
      await Promise.all(tasksToRun.map(t => t.run(telegram)))
    } catch (error) {
      logger.error({ error }, "Error while running tasks")
    } finally {
      tasksToRun.forEach(t => (t.done = true))
      await db.persist(tasksToRun).flush()
    }
  })
  taskJob.start()
  return () => taskJob.stop()
}

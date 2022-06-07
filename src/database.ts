import { MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import logger from "./log.js"
import ormOptions from "./mikro-orm.config"

const dbConnctionString = process.env.DB_CONNECTION

if (!dbConnctionString) {
  logger.fatal("No database connection string provided, exiting")
  process.exit(3)
}

const MikroOrm = (async () => {
  const db = await MikroORM.init<PostgreSqlDriver>(ormOptions)
  const migrationsRun = await db.getMigrator().up() // Ensure migrations are done before use of database
  if (migrationsRun.length > 0) {
    logger.info({ migrationAmount: migrationsRun.length }, "mirko-orm ran migrations on startup")
  }
  return db
})()

export default MikroOrm

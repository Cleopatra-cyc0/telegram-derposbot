import { MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import logger from "./log"
import ormOptions from "./mikro-orm.config"

const dbConnctionString = process.env.DB_CONNECTION

if (!dbConnctionString) {
  logger.fatal("No database connection string provided, exiting")
  process.exit(3)
}

const db = (async () => {
  const db = await MikroORM.init<PostgreSqlDriver>(ormOptions)
  await db.getMigrator().up() // Ensure migrations are done before use of database
  return db
})()

export default db

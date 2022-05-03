import { MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import logger from "./log.js"
import ormOptions from "./mikro-orm.config"

const dbConnctionString = process.env.DB_CONNECTION

if (!dbConnctionString) {
  logger.fatal("No database connection string provided, exiting")
  process.exit(3)
}

const db = MikroORM.init<PostgreSqlDriver>(ormOptions)

export default db

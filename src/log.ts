import Pino from "pino"
import { hrtime } from "process"

export default Pino({
  level: process.env.LOG_LEVEL,
})

export const track = (): (() => { timeTaken: bigint }) => {
  const start = hrtime.bigint()
  return () => {
    return { timeTaken: hrtime.bigint() - start }
  }
}

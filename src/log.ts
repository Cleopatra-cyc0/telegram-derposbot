import Pino from "pino"
import { hrtime } from "process"

const pinoTransport =
  process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
          },
        },
      }
    : {}

const logger = Pino({
  level: process.env.LOG_LEVEL,
  ...pinoTransport,
})

export default logger

export const track = (): (() => { timeTaken: bigint }) => {
  const start = hrtime.bigint()
  return () => {
    return { timeTaken: hrtime.bigint() - start }
  }
}

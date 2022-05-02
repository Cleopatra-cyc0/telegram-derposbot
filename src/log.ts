import Pino from "pino"
import { hrtime } from "process"

export default Pino()

export const track = (): (() => { timeTaken: bigint }) => {
  const start = hrtime.bigint()
  return () => {
    return { timeTaken: hrtime.bigint() - start }
  }
}

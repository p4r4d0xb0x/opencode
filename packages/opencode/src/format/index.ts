import { runPromiseInstance } from "@/effect/runtime"
import { Format as S } from "./service"

export const Format = {
  Status: S.Status,
  Service: S.Service,
  layer: S.layer,
  async status() {
    return runPromiseInstance(S.Service.use((s) => s.status()))
  },
}

export namespace Format {
  export type Status = S.Status
  export type Interface = S.Interface
}

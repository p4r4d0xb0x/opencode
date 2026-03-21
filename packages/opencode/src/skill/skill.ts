import { runPromiseInstance } from "@/effect/runtime"
import type { Agent } from "@/agent/agent"
import { Skill as S } from "./service"

export const Skill = {
  Info: S.Info,
  InvalidError: S.InvalidError,
  NameMismatchError: S.NameMismatchError,
  Service: S.Service,
  layer: S.layer,
  defaultLayer: S.defaultLayer,
  fmt: S.fmt,
  async get(name: string) {
    return runPromiseInstance(S.Service.use((skill) => skill.get(name)))
  },
  async all() {
    return runPromiseInstance(S.Service.use((skill) => skill.all()))
  },
  async dirs() {
    return runPromiseInstance(S.Service.use((skill) => skill.dirs()))
  },
  async available(agent?: Agent.Info) {
    return runPromiseInstance(S.Service.use((skill) => skill.available(agent)))
  },
}

export namespace Skill {
  export type Info = S.Info
  export type Interface = S.Interface
}

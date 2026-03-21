import { runPromiseInstance } from "@/effect/runtime"
import type { MessageID, SessionID } from "@/session/schema"
import type { QuestionID } from "./schema"
import { Question as S } from "./service"

export const Question = {
  Option: S.Option,
  Info: S.Info,
  Request: S.Request,
  Answer: S.Answer,
  Reply: S.Reply,
  Event: S.Event,
  RejectedError: S.RejectedError,
  Service: S.Service,
  layer: S.layer,
  async ask(input: {
    sessionID: SessionID
    questions: S.Info[]
    tool?: { messageID: MessageID; callID: string }
  }): Promise<S.Answer[]> {
    return runPromiseInstance(S.Service.use((s) => s.ask(input)))
  },
  async reply(input: { requestID: QuestionID; answers: S.Answer[] }) {
    return runPromiseInstance(S.Service.use((s) => s.reply(input)))
  },
  async reject(requestID: QuestionID) {
    return runPromiseInstance(S.Service.use((s) => s.reject(requestID)))
  },
  async list() {
    return runPromiseInstance(S.Service.use((s) => s.list()))
  },
}

export namespace Question {
  export type Option = S.Option
  export type Info = S.Info
  export type Request = S.Request
  export type Answer = S.Answer
  export type Reply = S.Reply
  export type Interface = S.Interface
}

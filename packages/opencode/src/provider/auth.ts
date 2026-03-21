import { runPromiseInstance } from "@/effect/runtime"
import { fn } from "@/util/fn"
import { ProviderID } from "./schema"
import z from "zod"
import { ProviderAuth as S } from "./auth-service"

export const ProviderAuth = {
  Method: S.Method,
  Authorization: S.Authorization,
  OauthMissing: S.OauthMissing,
  OauthCodeMissing: S.OauthCodeMissing,
  OauthCallbackFailed: S.OauthCallbackFailed,
  ValidationFailed: S.ValidationFailed,
  Service: S.Service,
  layer: S.layer,
  defaultLayer: S.defaultLayer,
  async methods() {
    return runPromiseInstance(S.Service.use((svc) => svc.methods()))
  },
  authorize: fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      inputs: z.record(z.string(), z.string()).optional(),
    }),
    async (input): Promise<S.Authorization | undefined> => runPromiseInstance(S.Service.use((svc) => svc.authorize(input))),
  ),
  callback: fn(
    z.object({
      providerID: ProviderID.zod,
      method: z.number(),
      code: z.string().optional(),
    }),
    async (input) => runPromiseInstance(S.Service.use((svc) => svc.callback(input))),
  ),
}

export namespace ProviderAuth {
  export type Method = S.Method
  export type Authorization = S.Authorization
  export type Error = S.Error
  export type Interface = S.Interface
}

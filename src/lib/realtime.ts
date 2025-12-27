import { redis } from "@/lib/redis"
import { InferRealtimeEvents, Realtime } from "@upstash/realtime"
import { z } from "zod"

const roomId = z.string().min(1).max(64)
const token = z.string().min(10).max(128)
const username = z.string().min(1).max(32)

const baseEnvelope = z.object({
  roomId,
  timestamp: z.number().int().nonnegative(),
})

export const message = baseEnvelope.extend({
  id: z.string().min(1).max(64),
  sender: username,
  text: z.string().min(1).max(2000),
  token: token.optional(),
})

export const presenceJoin = baseEnvelope.extend({
  token,
  username,
})

export const presenceLeave = baseEnvelope.extend({
  token,
})

export const typing = baseEnvelope.extend({
  token,
  username,
  isTyping: z.boolean(),
})

export const destroy = z.object({
  isDestroyed: z.literal(true),
  roomId,
  timestamp: z.number().int().nonnegative(),
})

export const deleteMessage = z.object({
  messageId: z.string(),
  roomId,
  timestamp: z.number().int().nonnegative(),
})

const schema = {
  chat: {
    message,
    join: presenceJoin,
    leave: presenceLeave,
    typing,
    destroy,
    delete: deleteMessage,
  },
} as const

export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>

export type Message = z.infer<typeof message>
export type PresenceJoin = z.infer<typeof presenceJoin>
export type PresenceLeave = z.infer<typeof presenceLeave>
export type Typing = z.infer<typeof typing>

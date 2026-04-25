import { redis } from "@/lib/redis"
import { MAX_TRANSPORT_MESSAGE_LENGTH } from "@/lib/message-limits"
import { InferRealtimeEvents, Realtime } from "@upstash/realtime"
import { z } from "zod"

const roomId = z.string().min(1).max(64)
const username = z.string().min(1).max(32)

const baseEnvelope = z.object({
  roomId,
  timestamp: z.number().int().nonnegative(),
})

export const message = baseEnvelope.extend({
  id: z.string().min(1).max(64),
  sender: username,
  text: z.string().min(1).max(MAX_TRANSPORT_MESSAGE_LENGTH),
})

export const presenceJoin = baseEnvelope.extend({
  username,
})

export const presenceLeave = baseEnvelope.extend({
  username,
})

export const typing = baseEnvelope.extend({
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

export const react = z.object({
  messageId: z.string(),
  emoji: z.string().max(8),
  action: z.enum(["add", "remove"]),
  roomId,
  timestamp: z.number().int().nonnegative(),
})

export const pin = z.object({
  messageId: z.string(),
  sender: username,
  text: z.string().max(MAX_TRANSPORT_MESSAGE_LENGTH),
  action: z.enum(["pin", "unpin"]),
  pinnedBy: username,
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
    react,
    pin,
  },
  channel: {
    message,
    join: presenceJoin,
    leave: presenceLeave,
    typing,
    delete: deleteMessage,
    react,
    pin,
  },
  group: {
    message,
    join: presenceJoin,
    leave: presenceLeave,
    typing,
    destroy,
    delete: deleteMessage,
    react,
    pin,
  },
} as const

export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>

export type Message = z.infer<typeof message>
export type PresenceJoin = z.infer<typeof presenceJoin>
export type PresenceLeave = z.infer<typeof presenceLeave>
export type Typing = z.infer<typeof typing>

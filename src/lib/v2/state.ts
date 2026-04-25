import { idbGet, idbGetAll, idbPut } from "./idb"
import type {
  V2ContactRecord,
  V2ConversationMessage,
  V2ConversationRecord,
} from "./types"

export async function upsertContact(contact: V2ContactRecord) {
  await idbPut("contacts", contact.userId, contact)
}

export async function getContact(userId: string) {
  return await idbGet<V2ContactRecord>("contacts", userId)
}

export async function listContacts() {
  const contacts = await idbGetAll<V2ContactRecord>("contacts")
  return contacts.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
}

export async function upsertConversation(conversation: V2ConversationRecord) {
  await idbPut("conversations", conversation.conversationId, conversation)
}

export async function getConversation(conversationId: string) {
  return await idbGet<V2ConversationRecord>("conversations", conversationId)
}

export async function listConversations() {
  const conversations = await idbGetAll<V2ConversationRecord>("conversations")
  return conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
}

export async function saveMessage(message: V2ConversationMessage) {
  await idbPut("messages", message.id, message)
}

export async function listMessages(conversationId: string) {
  const messages = await idbGetAll<V2ConversationMessage>("messages")
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.sentAt - b.sentAt)
}

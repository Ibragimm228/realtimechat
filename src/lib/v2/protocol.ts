"use client"

import { nanoid } from "nanoid"

import {
  apiBootstrap,
  apiCreateGroup,
  apiFetchInbox,
  apiGetGroup,
  apiGetTransparency,
  apiGetUserBundles,
  apiGetUserDevices,
  apiRefreshPrekeys,
  apiSendDirect,
  apiSendGroup,
  apiAckInbox,
} from "./api"
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./codec"
import { idbGet, idbPut } from "./idb"
import {
  getLocalDeviceState,
  listKyberPreKeyRecords,
  listPreKeyRecords,
  listSenderKeyRecords,
  listSessionRecords,
  listSignedPreKeyRecords,
  setLocalDeviceState,
  storeKyberPreKeyRecord,
  storePreKeyRecord,
  storeSenderKeyRecord,
  storeSessionRecord,
  storeSignedPreKeyRecord,
} from "./signal-store"
import { getContact, listConversations, listMessages, saveMessage, upsertContact, upsertConversation } from "./state"
import type {
  V2ConversationMessage,
  V2ConversationRecord,
  V2DeviceBundleClaim,
  V2DirectEnvelope,
  V2GroupEnvelope,
  V2LocalDeviceState,
} from "./types"

type SignalWasmModule = typeof import("@getmaapp/signal-wasm")
type WasmSignalClient = import("@getmaapp/signal-wasm").SignalClient

type WasmPreKey = {
  id: number
  public_key: Uint8Array
  record: Uint8Array
}

type WasmSignedPreKey = {
  id: number
  public_key: Uint8Array
  record: Uint8Array
  signature: Uint8Array
}

type WasmKyberPreKey = {
  id: number
  public_key: Uint8Array
  record: Uint8Array
  signature: Uint8Array
}

type LocalGroupState = {
  groupId: string
  title: string
  epoch: number
  distributionId: string
}

type DirectTransportEnvelope = V2DirectEnvelope | (V2GroupEnvelope & { kind: "group-key" })
type OutboundGroupKeyEnvelope = Omit<V2GroupEnvelope & { kind: "group-key" }, "envelopeId" | "groupId" | "epoch">
type OutboundGroupMessageEnvelope = Omit<V2GroupEnvelope & { kind: "group-message" }, "envelopeId" | "groupId" | "epoch">

let wasmPromise: Promise<SignalWasmModule> | null = null

function directConversationId(a: string, b: string) {
  return ["direct", ...[a, b].sort()].join(":")
}

function groupStateKey(groupId: string) {
  return `group:${groupId}`
}

async function getSignalWasm() {
  if (!wasmPromise) {
    wasmPromise = import("@getmaapp/signal-wasm").then(async (mod) => {
      await mod.default()
      return mod
    })
  }

  return await wasmPromise
}

async function restoreSignalClient() {
  const mod = await getSignalWasm()
  const local = await getLocalDeviceState()
  if (!local) {
    throw new Error("V2 device not initialized")
  }

  const client = mod.SignalClient.restore(
    base64ToBytes(local.identityPublicKey),
    base64ToBytes(local.identityPrivateKey),
    local.registrationId,
    local.userId,
    local.deviceId,
    local.nextPreKeyId,
    local.nextSignedPreKeyId,
    local.nextKyberPreKeyId,
  )

  for (const entry of await listPreKeyRecords()) {
    await client.import_pre_key(Number.parseInt(entry.key, 10), base64ToBytes(entry.value))
  }
  for (const entry of await listSignedPreKeyRecords()) {
    await client.import_signed_pre_key(Number.parseInt(entry.key, 10), base64ToBytes(entry.value))
  }
  for (const entry of await listKyberPreKeyRecords()) {
    await client.import_kyber_pre_key(Number.parseInt(entry.key, 10), base64ToBytes(entry.value))
  }
  for (const entry of await listSessionRecords()) {
    const [userId, deviceIdRaw] = entry.key.split(":")
    await client.import_session(userId, Number.parseInt(deviceIdRaw, 10), base64ToBytes(entry.value))
  }
  for (const entry of await listSenderKeyRecords()) {
    const [userId, deviceIdRaw, distributionId] = entry.key.split(":")
    await client.import_sender_key(userId, Number.parseInt(deviceIdRaw, 10), distributionId, base64ToBytes(entry.value))
  }

  return { mod, client, local }
}

async function updateLocalCounters(client: WasmSignalClient, current: V2LocalDeviceState) {
  await setLocalDeviceState({
    ...current,
    nextPreKeyId: client.get_next_pre_key_id(),
    nextSignedPreKeyId: client.get_next_signed_pre_key_id(),
    nextKyberPreKeyId: client.get_next_kyber_pre_key_id(),
  })
}

async function persistSession(client: WasmSignalClient, userId: string, deviceId: number) {
  const bytes = await client.export_session(userId, deviceId)
  if (bytes) {
    await storeSessionRecord(userId, deviceId, bytesToBase64(bytes))
  }
}

async function persistSenderKey(client: WasmSignalClient, userId: string, deviceId: number, distributionId: string) {
  const bytes = await client.export_sender_key(userId, deviceId, distributionId)
  if (bytes) {
    await storeSenderKeyRecord(userId, deviceId, distributionId, bytesToBase64(bytes))
  }
}

function createDirectConversationRecord(localUserId: string, remoteUserId: string, title: string): V2ConversationRecord {
  return {
    conversationId: directConversationId(localUserId, remoteUserId),
    kind: "direct",
    title,
    counterpartUserId: remoteUserId,
    counterpartProfileName: title,
    lastMessageAt: Date.now(),
  }
}

async function rememberContactFromClaims(claims: V2DeviceBundleClaim[]) {
  if (claims.length === 0) return

  const existing = await getContact(claims[0].userId)
  const identityKeys = Array.from(
    new Set([...(existing?.identityKeys || []), ...claims.map((claim) => claim.device.identityKey)]),
  )

  await upsertContact({
    userId: claims[0].userId,
    profileName: claims[0].profileName,
    identityKeys,
    lastSeenAt: Date.now(),
    verifiedFingerprint: existing?.verifiedFingerprint || null,
  })
}

function mapMessageType(
  mod: SignalWasmModule,
  type: number,
): "prekey" | "whisper" {
  return type === mod.message_type_pre_key() ? "prekey" : "whisper"
}

function directMessageType(mod: SignalWasmModule, type: "prekey" | "whisper" | "sender-key") {
  return type === "prekey" ? mod.message_type_pre_key() : mod.message_type_signal()
}

async function createBootstrapMaterial(localUuid: string, localDeviceId: number, preKeyCount = 32) {
  const mod = await getSignalWasm()
  const client = new mod.SignalClient(localUuid, localDeviceId)
  const identityKeyPair = client.get_identity_key_pair()
  const preKeys = client.generate_pre_keys(preKeyCount) as WasmPreKey[]
  const signedPreKey = client.generate_signed_pre_key() as WasmSignedPreKey
  const kyberPreKey = client.generate_kyber_pre_key() as WasmKyberPreKey

  return {
    mod,
    client,
    identityKeyPair,
    preKeys,
    signedPreKey,
    kyberPreKey,
  }
}

async function persistBootstrapMaterial(
  client: WasmSignalClient,
  identityKeyPair: { public_key: Uint8Array; private_key: Uint8Array },
  preKeys: WasmPreKey[],
  signedPreKey: WasmSignedPreKey,
  kyberPreKey: WasmKyberPreKey,
  localState: V2LocalDeviceState,
) {
  for (const preKey of preKeys) {
    await storePreKeyRecord(preKey.id, bytesToBase64(preKey.record))
  }

  await storeSignedPreKeyRecord(signedPreKey.id, bytesToBase64(signedPreKey.record))
  await storeKyberPreKeyRecord(kyberPreKey.id, bytesToBase64(kyberPreKey.record))
  await updateLocalCounters(client, localState)

  await setLocalDeviceState({
    ...localState,
    identityPublicKey: bytesToBase64(identityKeyPair.public_key),
    identityPrivateKey: bytesToBase64(identityKeyPair.private_key),
  })
}

async function ensureSessionsForUser(remoteUserId: string, excludeDeviceId?: number) {
  const { client } = await restoreSignalClient()
  const remoteDevices = await apiGetUserDevices(remoteUserId)
  const activeDevices = remoteDevices.devices.filter(
    (device) => device.revokedAt === null && device.deviceId !== excludeDeviceId,
  )
  const missingDevices: number[] = []

  for (const device of activeDevices) {
    const hasSession = await client.has_session(remoteUserId, device.deviceId)
    if (!hasSession) {
      missingDevices.push(device.deviceId)
    }
  }

  if (missingDevices.length === 0) {
    return activeDevices
  }

  const claims = await apiGetUserBundles(remoteUserId, excludeDeviceId)
  await rememberContactFromClaims(claims.bundles)

  for (const claim of claims.bundles.filter((item) => item.device.revokedAt === null)) {
    await client.process_pre_key_bundle(
      claim.userId,
      claim.device.deviceId,
      claim.device.registrationId,
      base64ToBytes(claim.device.identityKey),
      claim.device.signedPreKey.id,
      base64ToBytes(claim.device.signedPreKey.publicKey),
      base64ToBytes(claim.device.signedPreKey.signature),
      claim.oneTimePreKey?.id ?? null,
      claim.oneTimePreKey ? base64ToBytes(claim.oneTimePreKey.publicKey) : null,
      claim.device.kyberPreKey.id,
      base64ToBytes(claim.device.kyberPreKey.publicKey),
      base64ToBytes(claim.device.kyberPreKey.signature),
    )
    await persistSession(client, claim.userId, claim.device.deviceId)
  }

  return (await apiGetUserDevices(remoteUserId)).devices.filter((device) => device.revokedAt === null)
}

async function decryptDirectEnvelopeToBytes(
  envelope: DirectTransportEnvelope,
) {
  const { mod, client } = await restoreSignalClient()
  const plaintext = await client.decrypt_message(
    envelope.senderUserId,
    envelope.senderDeviceId,
    base64ToBytes(envelope.ciphertext),
    directMessageType(mod, envelope.ciphertextType),
  )

  await persistSession(client, envelope.senderUserId, envelope.senderDeviceId)
  return plaintext
}

async function saveIncomingDirectMessage(envelope: V2DirectEnvelope, plaintext: string) {
  const local = await getLocalDeviceState()
  if (!local) return

  if (envelope.senderUserId === local.userId && envelope.peerUserId) {
    await saveOutgoingDirectMessage(envelope.peerUserId, plaintext, envelope.sentAt)
    return
  }

  const contact = await getContact(envelope.senderUserId)
  const conversation = createDirectConversationRecord(
    local.userId,
    envelope.senderUserId,
    contact?.profileName || envelope.senderUserId,
  )

  await upsertConversation({
    ...conversation,
    lastMessageAt: envelope.sentAt,
  })

  const message: V2ConversationMessage = {
    id: envelope.envelopeId,
    conversationId: conversation.conversationId,
    fromUserId: envelope.senderUserId,
    fromDeviceId: envelope.senderDeviceId,
    toUserId: local.userId,
    direction: "incoming",
    plaintext,
    sentAt: envelope.sentAt,
    kind: "direct",
  }

  await saveMessage(message)
}

async function saveOutgoingDirectMessage(recipientUserId: string, plaintext: string, sentAt: number) {
  const local = await getLocalDeviceState()
  if (!local) return

  const contact = await getContact(recipientUserId)
  const conversation = createDirectConversationRecord(
    local.userId,
    recipientUserId,
    contact?.profileName || recipientUserId,
  )

  await upsertConversation({
    ...conversation,
    counterpartProfileName: contact?.profileName || recipientUserId,
    lastMessageAt: sentAt,
  })

  await saveMessage({
    id: nanoid(),
    conversationId: conversation.conversationId,
    fromUserId: local.userId,
    fromDeviceId: local.deviceId,
    toUserId: recipientUserId,
    direction: "outgoing",
    plaintext,
    sentAt,
    kind: "direct",
  })
}

async function getGroupState(groupId: string) {
  return await idbGet<LocalGroupState>("groups", groupStateKey(groupId))
}

async function setGroupState(state: LocalGroupState) {
  await idbPut("groups", groupStateKey(state.groupId), state)
}

export async function bootstrapNewIdentity(profileName: string, deviceLabel: string, linkToken?: string) {
  const provisionalUserId = crypto.randomUUID()
  const provisionalDeviceId = 1
  const material = await createBootstrapMaterial(provisionalUserId, provisionalDeviceId)

  const bootstrapped = await apiBootstrap({
    userId: linkToken ? undefined : provisionalUserId,
    linkToken,
    profileName,
    deviceLabel,
    bundle: {
      registrationId: material.client.get_registration_id(),
      identityKey: bytesToBase64(material.client.get_identity_public_key()),
      signedPreKey: {
        id: material.signedPreKey.id,
        publicKey: bytesToBase64(material.signedPreKey.public_key),
        signature: bytesToBase64(material.signedPreKey.signature),
      },
      kyberPreKey: {
        id: material.kyberPreKey.id,
        publicKey: bytesToBase64(material.kyberPreKey.public_key),
        signature: bytesToBase64(material.kyberPreKey.signature),
      },
      oneTimePreKeys: material.preKeys.map((preKey) => ({
        id: preKey.id,
        publicKey: bytesToBase64(preKey.public_key),
      })),
    },
  })

  const localState: V2LocalDeviceState = {
    userId: bootstrapped.userId,
    deviceId: bootstrapped.deviceId,
    profileName: bootstrapped.profileName,
    deviceLabel: bootstrapped.deviceLabel,
    deviceAuthToken: bootstrapped.deviceAuthToken,
    registrationId: material.client.get_registration_id(),
    identityPublicKey: bytesToBase64(material.identityKeyPair.public_key),
    identityPrivateKey: bytesToBase64(material.identityKeyPair.private_key),
    nextPreKeyId: material.client.get_next_pre_key_id(),
    nextSignedPreKeyId: material.client.get_next_signed_pre_key_id(),
    nextKyberPreKeyId: material.client.get_next_kyber_pre_key_id(),
    createdAt: Date.now(),
  }

  await setLocalDeviceState(localState)
  await persistBootstrapMaterial(
    material.client,
    material.identityKeyPair,
    material.preKeys,
    material.signedPreKey,
    material.kyberPreKey,
    localState,
  )

  return localState
}

export async function refreshLocalPreKeys() {
  const { client, local } = await restoreSignalClient()
  const preKeys = client.generate_pre_keys(32) as WasmPreKey[]
  const signedPreKey = client.generate_signed_pre_key() as WasmSignedPreKey
  const kyberPreKey = client.generate_kyber_pre_key() as WasmKyberPreKey

  await apiRefreshPrekeys({
    registrationId: client.get_registration_id(),
    identityKey: bytesToBase64(client.get_identity_public_key()),
    signedPreKey: {
      id: signedPreKey.id,
      publicKey: bytesToBase64(signedPreKey.public_key),
      signature: bytesToBase64(signedPreKey.signature),
    },
    kyberPreKey: {
      id: kyberPreKey.id,
      publicKey: bytesToBase64(kyberPreKey.public_key),
      signature: bytesToBase64(kyberPreKey.signature),
    },
    oneTimePreKeys: preKeys.map((preKey) => ({
      id: preKey.id,
      publicKey: bytesToBase64(preKey.public_key),
    })),
  })

  for (const preKey of preKeys) {
    await storePreKeyRecord(preKey.id, bytesToBase64(preKey.record))
  }
  await storeSignedPreKeyRecord(signedPreKey.id, bytesToBase64(signedPreKey.record))
  await storeKyberPreKeyRecord(kyberPreKey.id, bytesToBase64(kyberPreKey.record))
  await updateLocalCounters(client, local)
}

export async function startDirectConversation(remoteUserId: string) {
  const local = await getLocalDeviceState()
  if (!local) throw new Error("V2 device not initialized")

  const devices = await ensureSessionsForUser(remoteUserId)
  const contact = await getContact(remoteUserId)
  const conversation = createDirectConversationRecord(
    local.userId,
    remoteUserId,
    contact?.profileName || remoteUserId,
  )
  await upsertConversation(conversation)

  return { conversation, devices }
}

export async function sendDirectText(recipientUserId: string, plaintext: string) {
  const { mod, client, local } = await restoreSignalClient()
  const recipientDevices = await ensureSessionsForUser(recipientUserId)
  const ownSecondaryDevices = await ensureSessionsForUser(local.userId, local.deviceId)
  const sentAt = Date.now()
  const conversationId = directConversationId(local.userId, recipientUserId)

  const envelopes = await Promise.all(
    [
      ...recipientDevices.map((device) => ({ device, targetUserId: recipientUserId, peerUserId: undefined as string | undefined })),
      ...ownSecondaryDevices.map((device) => ({ device, targetUserId: local.userId, peerUserId: recipientUserId })),
    ].map(async ({ device, targetUserId, peerUserId }) => {
      const ciphertext = await client.encrypt_message(targetUserId, device.deviceId, utf8ToBytes(plaintext))
      await persistSession(client, targetUserId, device.deviceId)

      return {
        kind: "direct" as const,
        conversationId,
        peerUserId,
        senderUserId: local.userId,
        senderDeviceId: local.deviceId,
        recipientUserId: targetUserId,
        recipientDeviceId: device.deviceId,
        ciphertextType: mapMessageType(mod, ciphertext.message_type),
        ciphertext: bytesToBase64(ciphertext.body),
        sentAt,
        clientMessageId: nanoid(),
      }
    }),
  )

  await apiSendDirect({
    senderUserId: local.userId,
    senderDeviceId: local.deviceId,
    recipientUserId,
    envelopes,
  })

  await saveOutgoingDirectMessage(recipientUserId, plaintext, sentAt)
  return envelopes
}

export async function syncInbox() {
  const { client, local } = await restoreSignalClient()
  const inbox = await apiFetchInbox(100)
  const ackIds: string[] = []

  for (const envelope of inbox.envelopes) {
    try {
      if (envelope.kind === "direct") {
        const plaintext = bytesToUtf8(await decryptDirectEnvelopeToBytes(envelope))
        await saveIncomingDirectMessage(envelope, plaintext)
      } else if (envelope.kind === "group-key") {
        const keyEnvelope = envelope as V2GroupEnvelope & { kind: "group-key" }
        const decrypted = await decryptDirectEnvelopeToBytes(keyEnvelope)
        await client.process_sender_key_distribution(
          keyEnvelope.senderUserId,
          keyEnvelope.senderDeviceId,
          decrypted,
        )

        const existing = await getGroupState(keyEnvelope.groupId)
        const distributionId = keyEnvelope.distributionId || crypto.randomUUID()
        await persistSenderKey(client, keyEnvelope.senderUserId, keyEnvelope.senderDeviceId, distributionId)
        await setGroupState({
          groupId: keyEnvelope.groupId,
          title: existing?.title || keyEnvelope.groupId,
          epoch: keyEnvelope.epoch,
          distributionId,
        })
      } else if (envelope.kind === "group-message") {
        const plaintext = bytesToUtf8(
          await client.decrypt_group_message(
            envelope.senderUserId,
            envelope.senderDeviceId,
            base64ToBytes(envelope.ciphertext),
          ),
        )

        const distributionId = envelope.distributionId || crypto.randomUUID()
        await persistSenderKey(client, envelope.senderUserId, envelope.senderDeviceId, distributionId)

        const groupState = await getGroupState(envelope.groupId)
        await upsertConversation({
          conversationId: `group:${envelope.groupId}`,
          kind: "group",
          title: groupState?.title || envelope.groupId,
          groupId: envelope.groupId,
          distributionId: groupState?.distributionId || distributionId,
          epoch: envelope.epoch,
          lastMessageAt: envelope.sentAt,
        })
        await saveMessage({
          id: envelope.envelopeId,
          conversationId: `group:${envelope.groupId}`,
          fromUserId: envelope.senderUserId,
          fromDeviceId: envelope.senderDeviceId,
          groupId: envelope.groupId,
          direction: envelope.senderUserId === local.userId ? "outgoing" : "incoming",
          plaintext,
          sentAt: envelope.sentAt,
          kind: "group",
        })
      }

      ackIds.push(envelope.envelopeId)
    } catch {
    }
  }

  if (ackIds.length > 0) {
    await apiAckInbox(ackIds)
  }

  return ackIds.length
}

export async function getSafetyNumbers(remoteUserId: string) {
  const { client } = await restoreSignalClient()
  const remote = await apiGetUserDevices(remoteUserId)

  return remote.devices
    .filter((device) => device.revokedAt === null)
    .map((device) => {
      const safety = client.generate_safety_number(remoteUserId, base64ToBytes(device.identityKey))
      return {
        deviceId: device.deviceId,
        display: safety.displayable,
      }
    })
}

export async function createGroup(title: string, memberUserIds: string[]) {
  const local = await getLocalDeviceState()
  if (!local) throw new Error("V2 device not initialized")

  const { group } = await apiCreateGroup(title, memberUserIds)
  const distributionId = crypto.randomUUID()

  await setGroupState({
    groupId: group.groupId,
    title: group.title,
    epoch: group.currentEpoch,
    distributionId,
  })
  await upsertConversation({
    conversationId: `group:${group.groupId}`,
    kind: "group",
    title: group.title,
    groupId: group.groupId,
    distributionId,
    epoch: group.currentEpoch,
    lastMessageAt: Date.now(),
  })

  await distributeSenderKey(group.groupId)
  return group
}

export async function distributeSenderKey(groupId: string) {
  const { mod, client, local } = await restoreSignalClient()
  const groupState = await getGroupState(groupId)
  const groupInfo = await apiGetGroup(groupId)

  const distributionId = groupState?.distributionId || crypto.randomUUID()
  const distributionMessage = await client.create_sender_key_distribution(distributionId)
  await persistSenderKey(client, local.userId, local.deviceId, distributionId)

  const memberUserIds = groupInfo.members
    .filter((member) => member.active)
    .map((member) => member.userId)

  const envelopes: OutboundGroupKeyEnvelope[] = []

  for (const userId of memberUserIds) {
    const devices = await ensureSessionsForUser(userId, userId === local.userId ? local.deviceId : undefined)

    for (const device of devices) {
      const ciphertext = await client.encrypt_message(userId, device.deviceId, distributionMessage)
      await persistSession(client, userId, device.deviceId)

      envelopes.push({
        kind: "group-key",
        distributionId,
        senderUserId: local.userId,
        senderDeviceId: local.deviceId,
        recipientUserId: userId,
        recipientDeviceId: device.deviceId,
        ciphertextType: mapMessageType(mod, ciphertext.message_type),
        ciphertext: bytesToBase64(ciphertext.body),
        sentAt: Date.now(),
        clientMessageId: nanoid(),
      })
    }
  }

  if (envelopes.length > 0) {
    await apiSendGroup({
      senderUserId: local.userId,
      senderDeviceId: local.deviceId,
      groupId,
      epoch: groupInfo.group.currentEpoch,
      envelopes,
    })
  }

  await setGroupState({
    groupId,
    title: groupInfo.group.title,
    epoch: groupInfo.group.currentEpoch,
    distributionId,
  })
}

export async function sendGroupText(groupId: string, plaintext: string) {
  const { client, local } = await restoreSignalClient()
  const groupState = await getGroupState(groupId)
  if (!groupState) {
    throw new Error("Group sender key is not initialized")
  }

  const groupInfo = await apiGetGroup(groupId)
  const ciphertext = await client.encrypt_group_message(groupState.distributionId, utf8ToBytes(plaintext))
  await persistSenderKey(client, local.userId, local.deviceId, groupState.distributionId)

  const sentAt = Date.now()
  const envelopes: OutboundGroupMessageEnvelope[] = []

  for (const member of groupInfo.members.filter((item) => item.active)) {
    const devices = await ensureSessionsForUser(
      member.userId,
      member.userId === local.userId ? local.deviceId : undefined,
    )
    for (const device of devices) {
      envelopes.push({
        kind: "group-message",
        distributionId: groupState.distributionId,
        senderUserId: local.userId,
        senderDeviceId: local.deviceId,
        recipientUserId: member.userId,
        recipientDeviceId: device.deviceId,
        ciphertextType: "sender-key",
        ciphertext: bytesToBase64(ciphertext),
        sentAt,
        clientMessageId: nanoid(),
      })
    }
  }

  if (envelopes.length > 0) {
    await apiSendGroup({
      senderUserId: local.userId,
      senderDeviceId: local.deviceId,
      groupId,
      epoch: groupInfo.group.currentEpoch,
      envelopes,
    })
  }

  await upsertConversation({
    conversationId: `group:${groupId}`,
    kind: "group",
    title: groupInfo.group.title,
    groupId,
    distributionId: groupState.distributionId,
    epoch: groupInfo.group.currentEpoch,
    lastMessageAt: sentAt,
  })
  await saveMessage({
    id: nanoid(),
    conversationId: `group:${groupId}`,
    fromUserId: local.userId,
    fromDeviceId: local.deviceId,
    groupId,
    direction: "outgoing",
    plaintext,
    sentAt,
    kind: "group",
  })
}

export async function loadConversationState() {
  return {
    local: await getLocalDeviceState(),
    conversations: await listConversations(),
  }
}

export async function loadConversationMessages(conversationId: string) {
  return await listMessages(conversationId)
}

export async function loadTransparency(userId: string) {
  return await apiGetTransparency(userId)
}

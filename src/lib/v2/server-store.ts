import { nanoid } from "nanoid"
import { createHash, randomUUID } from "node:crypto"

import { redis } from "@/lib/redis"
import type {
  V2BootstrapRequest,
  V2BootstrapResponse,
  V2DeviceBundleClaim,
  V2DevicePrivateRecord,
  V2Envelope,
  V2GroupMembership,
  V2GroupRecord,
  V2LinkTokenRecord,
  V2MeResponse,
  V2TransparencyEvent,
  V2TransparencyEventType,
  V2UserProfile,
} from "./types"

const TRANSPARENCY_GENESIS = "GENESIS"
const LINK_TOKEN_TTL_SECONDS = 60 * 10

function userKey(userId: string) {
  return `v2:user:${userId}`
}

function userDevicesKey(userId: string) {
  return `v2:user:${userId}:devices`
}

function userGroupsKey(userId: string) {
  return `v2:user:${userId}:groups`
}

function deviceKey(userId: string, deviceId: number) {
  return `v2:device:${userId}:${deviceId}`
}

function prekeysKey(userId: string, deviceId: number) {
  return `v2:device:${userId}:${deviceId}:prekeys`
}

function inboxKey(userId: string, deviceId: number) {
  return `v2:inbox:${userId}:${deviceId}`
}

function envelopeKey(envelopeId: string) {
  return `v2:envelope:${envelopeId}`
}

function linkTokenKey(token: string) {
  return `v2:link:${token}`
}

function transparencyHeadKey() {
  return "v2:kt:head"
}

function transparencyEventKey(eventId: string) {
  return `v2:kt:event:${eventId}`
}

function transparencyUserListKey(userId: string) {
  return `v2:kt:user:${userId}`
}

function groupKey(groupId: string) {
  return `v2:group:${groupId}`
}

function groupMembersKey(groupId: string) {
  return `v2:group:${groupId}:members`
}

function safeProfileName(value: string) {
  return value.trim().slice(0, 64) || "Anonymous V2"
}

function safeDeviceLabel(value: string) {
  return value.trim().slice(0, 64) || "Primary Device"
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function hashPayload(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await redis.get<string>(key)
  if (!raw || typeof raw !== "string") return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJson(key: string, value: unknown, ttlSeconds?: number) {
  const raw = JSON.stringify(value)
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, raw, { ex: ttlSeconds })
    return
  }

  await redis.set(key, raw)
}

async function readStringList(key: string) {
  const values = await redis.lrange<string>(key, 0, -1)
  return (values || []).filter((item): item is string => typeof item === "string")
}

async function appendTransparencyEvent(
  userId: string,
  type: V2TransparencyEventType,
  payload: Record<string, unknown>,
) {
  const previousHash = (await redis.get<string>(transparencyHeadKey())) || TRANSPARENCY_GENESIS
  const createdAt = Date.now()
  const eventId = nanoid()
  const hash = hashPayload({ eventId, userId, type, createdAt, payload, previousHash })
  const event: V2TransparencyEvent = {
    eventId,
    userId,
    type,
    createdAt,
    payload,
    previousHash,
    hash,
  }

  await Promise.all([
    writeJson(transparencyEventKey(eventId), event),
    redis.rpush(transparencyUserListKey(userId), eventId),
    redis.set(transparencyHeadKey(), hash),
  ])

  return event
}

async function getUserProfile(userId: string) {
  return await readJson<V2UserProfile>(userKey(userId))
}

async function setUserProfile(profile: V2UserProfile) {
  await writeJson(userKey(profile.userId), profile)
}

async function getUserDeviceIds(userId: string) {
  const raw = await readStringList(userDevicesKey(userId))
  return raw
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0)
}

async function addUserDeviceId(userId: string, deviceId: number) {
  await redis.rpush(userDevicesKey(userId), String(deviceId))
}

async function getDeviceRecord(userId: string, deviceId: number) {
  return await readJson<V2DevicePrivateRecord>(deviceKey(userId, deviceId))
}

async function setDeviceRecord(record: V2DevicePrivateRecord) {
  await writeJson(deviceKey(record.userId, record.deviceId), record)
}

async function appendPrekeys(userId: string, deviceId: number, prekeys: V2BootstrapRequest["bundle"]["oneTimePreKeys"]) {
  if (prekeys.length === 0) return
  const values = prekeys.map((prekey) => JSON.stringify(prekey))
  await redis.rpush(prekeysKey(userId, deviceId), ...values)
}

async function popPrekey(userId: string, deviceId: number) {
  const raw = await redis.lpop<string>(prekeysKey(userId, deviceId))
  if (!raw || typeof raw !== "string") return null

  try {
    return JSON.parse(raw) as V2BootstrapRequest["bundle"]["oneTimePreKeys"][number]
  } catch {
    return null
  }
}

export async function bootstrapV2Identity(body: V2BootstrapRequest): Promise<V2BootstrapResponse> {
  const createdAt = Date.now()
  const profileName = safeProfileName(body.profileName)
  const deviceLabel = safeDeviceLabel(body.deviceLabel)
  const userId = body.linkToken
    ? (await consumeLinkToken(body.linkToken))?.userId
    : body.userId || randomUUID()

  if (!userId) {
    throw new Error("Invalid or expired link token")
  }

  const existingProfile = await getUserProfile(userId)
  if (!existingProfile) {
    await setUserProfile({ userId, profileName, createdAt })
    await appendTransparencyEvent(userId, "user.created", { profileName })
  }

  const existingDeviceIds = await getUserDeviceIds(userId)
  const deviceId = existingDeviceIds.length === 0 ? 1 : Math.max(...existingDeviceIds) + 1
  const deviceAuthToken = nanoid(48)

  const record: V2DevicePrivateRecord = {
    userId,
    deviceId,
    deviceLabel,
    registrationId: body.bundle.registrationId,
    createdAt,
    revokedAt: null,
    identityKey: body.bundle.identityKey,
    signedPreKey: body.bundle.signedPreKey,
    kyberPreKey: body.bundle.kyberPreKey,
    authTokenHash: hashToken(deviceAuthToken),
  }

  await Promise.all([
    setDeviceRecord(record),
    addUserDeviceId(userId, deviceId),
    appendPrekeys(userId, deviceId, body.bundle.oneTimePreKeys),
    appendTransparencyEvent(userId, "device.added", {
      deviceId,
      deviceLabel,
      registrationId: body.bundle.registrationId,
    }),
  ])

  const transparencyHead = (await redis.get<string>(transparencyHeadKey())) || TRANSPARENCY_GENESIS

  return {
    userId,
    deviceId,
    deviceAuthToken,
    profileName: existingProfile?.profileName || profileName,
    deviceLabel,
    transparencyHead,
  }
}

export async function refreshDevicePrekeys(
  userId: string,
  deviceId: number,
  bundle: V2BootstrapRequest["bundle"],
) {
  const device = await getDeviceRecord(userId, deviceId)
  if (!device) throw new Error("Device not found")

  const updated: V2DevicePrivateRecord = {
    ...device,
    registrationId: bundle.registrationId,
    identityKey: bundle.identityKey,
    signedPreKey: bundle.signedPreKey,
    kyberPreKey: bundle.kyberPreKey,
  }

  await Promise.all([
    setDeviceRecord(updated),
    appendPrekeys(userId, deviceId, bundle.oneTimePreKeys),
    appendTransparencyEvent(userId, "prekeys.refreshed", {
      deviceId,
      signedPreKeyId: bundle.signedPreKey.id,
      kyberPreKeyId: bundle.kyberPreKey.id,
      addedOneTimePreKeys: bundle.oneTimePreKeys.length,
    }),
  ])
}

export async function getPublicDevices(userId: string) {
  const deviceIds = await getUserDeviceIds(userId)
  const devices = await Promise.all(deviceIds.map((deviceId) => getDeviceRecord(userId, deviceId)))

  return devices
    .filter((device): device is V2DevicePrivateRecord => Boolean(device))
    .map((device) => ({
      userId: device.userId,
      deviceId: device.deviceId,
      deviceLabel: device.deviceLabel,
      registrationId: device.registrationId,
      createdAt: device.createdAt,
      revokedAt: device.revokedAt,
      identityKey: device.identityKey,
      signedPreKey: device.signedPreKey,
      kyberPreKey: device.kyberPreKey,
    }))
}

export async function claimPreKeyBundles(userId: string, excludeDeviceId?: number): Promise<V2DeviceBundleClaim[]> {
  const profile = await getUserProfile(userId)
  if (!profile) return []

  const devices = await getPublicDevices(userId)
  const activeDevices = devices.filter(
    (device) => device.revokedAt === null && device.deviceId !== excludeDeviceId,
  )

  return await Promise.all(
    activeDevices.map(async (device) => ({
      userId,
      profileName: profile.profileName,
      device,
      oneTimePreKey: await popPrekey(userId, device.deviceId),
    })),
  )
}

export async function authenticateDevice(userId: string, deviceId: number, authToken: string) {
  const record = await getDeviceRecord(userId, deviceId)
  if (!record || record.revokedAt !== null) return null

  if (record.authTokenHash !== hashToken(authToken)) {
    return null
  }

  return record
}

export async function getMe(userId: string) {
  const profile = await getUserProfile(userId)
  if (!profile) return null

  const devices = await getPublicDevices(userId)
  const transparencyHead = (await redis.get<string>(transparencyHeadKey())) || TRANSPARENCY_GENESIS
  const response: V2MeResponse = {
    profile,
    devices,
    transparencyHead,
  }

  return response
}

export async function createLinkToken(userId: string, deviceId: number) {
  const token = nanoid(32)
  const record: V2LinkTokenRecord = {
    token,
    userId,
    issuedByDeviceId: deviceId,
    expiresAt: Date.now() + LINK_TOKEN_TTL_SECONDS * 1000,
  }

  await writeJson(linkTokenKey(token), record, LINK_TOKEN_TTL_SECONDS)
  return record
}

export async function consumeLinkToken(token: string) {
  const record = await readJson<V2LinkTokenRecord>(linkTokenKey(token))
  if (!record) return null

  await redis.del(linkTokenKey(token))
  if (record.expiresAt < Date.now()) return null
  return record
}

export async function revokeDevice(userId: string, targetDeviceId: number) {
  const record = await getDeviceRecord(userId, targetDeviceId)
  if (!record || record.revokedAt !== null) return null

  const updated: V2DevicePrivateRecord = {
    ...record,
    revokedAt: Date.now(),
  }

  await Promise.all([
    setDeviceRecord(updated),
    appendTransparencyEvent(userId, "device.revoked", {
      deviceId: targetDeviceId,
    }),
  ])

  return updated
}

export async function queueEnvelopes(envelopes: Omit<V2Envelope, "envelopeId">[]) {
  const created: V2Envelope[] = []

  for (const envelope of envelopes) {
    const envelopeId = nanoid()
    const fullEnvelope: V2Envelope = { ...envelope, envelopeId } as V2Envelope
    created.push(fullEnvelope)

    await Promise.all([
      writeJson(envelopeKey(envelopeId), fullEnvelope),
      redis.rpush(inboxKey(envelope.recipientUserId, envelope.recipientDeviceId), envelopeId),
    ])
  }

  return created
}

export async function fetchInbox(userId: string, deviceId: number, limit = 50) {
  const ids = await redis.lrange<string>(inboxKey(userId, deviceId), 0, Math.max(0, limit - 1))
  const envelopeIds = (ids || []).filter((value): value is string => typeof value === "string")
  const envelopes = await Promise.all(envelopeIds.map((id) => readJson<V2Envelope>(envelopeKey(id))))

  return envelopes.filter((envelope): envelope is V2Envelope => Boolean(envelope))
}

export async function ackInbox(userId: string, deviceId: number, envelopeIds: string[]) {
  await Promise.all(
    envelopeIds.flatMap((envelopeId) => [
      redis.lrem(inboxKey(userId, deviceId), 0, envelopeId),
      redis.del(envelopeKey(envelopeId)),
    ]),
  )
}

async function readGroupMembers(groupId: string) {
  return (await readJson<V2GroupMembership[]>(groupMembersKey(groupId))) || []
}

async function writeGroupMembers(groupId: string, members: V2GroupMembership[]) {
  await writeJson(groupMembersKey(groupId), members)
}

async function addUserGroup(userId: string, groupId: string) {
  const groups = ((await readJson<string[]>(userGroupsKey(userId))) || []).filter(Boolean)
  if (!groups.includes(groupId)) {
    groups.push(groupId)
    await writeJson(userGroupsKey(userId), groups)
  }
}

export async function createGroupRecord(input: {
  title: string
  createdByUserId: string
  createdByDeviceId: number
  memberUserIds: string[]
}) {
  const groupId = randomUUID()
  const createdAt = Date.now()
  const record: V2GroupRecord = {
    groupId,
    title: input.title.trim().slice(0, 80) || "Secure Group",
    createdAt,
    createdByUserId: input.createdByUserId,
    createdByDeviceId: input.createdByDeviceId,
    currentEpoch: 1,
  }

  const members = Array.from(new Set([input.createdByUserId, ...input.memberUserIds]))
  const membership: V2GroupMembership[] = members.map((userId) => ({
    groupId,
    userId,
    joinedAt: createdAt,
    role: userId === input.createdByUserId ? "owner" : "member",
    active: true,
  }))

  await Promise.all([
    writeJson(groupKey(groupId), record),
    writeGroupMembers(groupId, membership),
    ...members.map((userId) => addUserGroup(userId, groupId)),
    appendTransparencyEvent(input.createdByUserId, "group.created", {
      groupId,
      title: record.title,
      members,
    }),
  ])

  return record
}

export async function getGroupRecord(groupId: string) {
  return await readJson<V2GroupRecord>(groupKey(groupId))
}

export async function getGroupMembers(groupId: string) {
  return (await readGroupMembers(groupId)).filter((member) => member.active)
}

export async function listGroupsForUser(userId: string) {
  const groupIds = ((await readJson<string[]>(userGroupsKey(userId))) || []).filter(Boolean)
  const groups = await Promise.all(groupIds.map((groupId) => getGroupRecord(groupId)))
  return groups.filter((group): group is V2GroupRecord => Boolean(group))
}

export async function mutateGroupMembership(input: {
  actorUserId: string
  groupId: string
  addUserIds?: string[]
  removeUserIds?: string[]
}) {
  const record = await getGroupRecord(input.groupId)
  if (!record) throw new Error("Group not found")

  const members = await readGroupMembers(input.groupId)
  const activeActor = members.find((member) => member.userId === input.actorUserId && member.active)
  if (!activeActor) {
    throw new Error("Only active members can change the group")
  }

  const next = [...members]
  const now = Date.now()

  for (const userId of input.addUserIds || []) {
    const existing = next.find((member) => member.userId === userId)
    if (existing) {
      existing.active = true
      existing.joinedAt = now
      continue
    }

    next.push({
      groupId: input.groupId,
      userId,
      joinedAt: now,
      role: "member",
      active: true,
    })
  }

  for (const userId of input.removeUserIds || []) {
    const existing = next.find((member) => member.userId === userId)
    if (existing) {
      existing.active = false
    }
  }

  const updated: V2GroupRecord = {
    ...record,
    currentEpoch: record.currentEpoch + 1,
  }

  await Promise.all([
    writeJson(groupKey(input.groupId), updated),
    writeGroupMembers(input.groupId, next),
    ...((input.addUserIds || []).map((userId) => addUserGroup(userId, input.groupId))),
    appendTransparencyEvent(input.actorUserId, "group.membership.changed", {
      groupId: input.groupId,
      epoch: updated.currentEpoch,
      added: input.addUserIds || [],
      removed: input.removeUserIds || [],
    }),
  ])

  return updated
}

export async function getTransparencyEvents(userId: string) {
  const ids = await readStringList(transparencyUserListKey(userId))
  const events = await Promise.all(ids.map((eventId) => readJson<V2TransparencyEvent>(transparencyEventKey(eventId))))
  return events.filter((event): event is V2TransparencyEvent => Boolean(event))
}

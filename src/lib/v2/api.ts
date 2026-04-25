import { getLocalDeviceState } from "./signal-store"
import type {
  V2BootstrapRequest,
  V2BootstrapResponse,
  V2DeviceBundleClaim,
  V2DevicePublicRecord,
  V2Envelope,
  V2GroupRecord,
  V2MeResponse,
  V2TransparencyEvent,
} from "./types"

function apiUrl(path: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  return `${base}${path}`
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || "Request failed")
  }
  return data
}

async function authorizedFetch(path: string, init?: RequestInit) {
  const state = await getLocalDeviceState()
  if (!state) {
    throw new Error("V2 device not initialized")
  }

  const headers = new Headers(init?.headers)
  headers.set("x-v2-user-id", state.userId)
  headers.set("x-v2-device-id", String(state.deviceId))
  headers.set("x-v2-device-token", state.deviceAuthToken)
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json")
  }

  return await fetch(apiUrl(path), {
    ...init,
    headers,
  })
}

export async function apiBootstrap(body: V2BootstrapRequest) {
  const response = await fetch(apiUrl("/api/v2/identity/bootstrap"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  return await parseJson<V2BootstrapResponse>(response)
}

export async function apiMe() {
  const response = await authorizedFetch("/api/v2/identity/me")
  return await parseJson<V2MeResponse>(response)
}

export async function apiRefreshPrekeys(bundle: V2BootstrapRequest["bundle"]) {
  const response = await authorizedFetch("/api/v2/identity/prekeys/refresh", {
    method: "POST",
    body: JSON.stringify({ bundle }),
  })
  return await parseJson<{ ok: true }>(response)
}

export async function apiGetUserBundles(userId: string, excludeDeviceId?: number) {
  const query = excludeDeviceId ? `?excludeDeviceId=${excludeDeviceId}` : ""
  const response = await fetch(apiUrl(`/api/v2/identity/users/${userId}/bundles${query}`))
  return await parseJson<{ bundles: V2DeviceBundleClaim[] }>(response)
}

export async function apiGetUserDevices(userId: string) {
  const response = await fetch(apiUrl(`/api/v2/identity/users/${userId}/devices`))
  return await parseJson<{ devices: V2DevicePublicRecord[] }>(response)
}

export async function apiCreateLinkToken() {
  const response = await authorizedFetch("/api/v2/identity/devices/link-token", {
    method: "POST",
  })
  return await parseJson<{ token: string; userId: string; issuedByDeviceId: number; expiresAt: number }>(response)
}

export async function apiRevokeDevice(targetDeviceId: number) {
  const response = await authorizedFetch("/api/v2/identity/devices/revoke", {
    method: "POST",
    body: JSON.stringify({ targetDeviceId }),
  })
  return await parseJson<{ ok: true }>(response)
}

export async function apiSendDirect(payload: {
  senderUserId: string
  senderDeviceId: number
  recipientUserId: string
  envelopes: Omit<Extract<V2Envelope, { kind: "direct" }>, "envelopeId">[]
}) {
  const response = await authorizedFetch("/api/v2/direct/send", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return await parseJson<{ queued: V2Envelope[] }>(response)
}

export async function apiFetchInbox(limit = 50) {
  const response = await authorizedFetch(`/api/v2/direct/inbox?limit=${limit}`)
  return await parseJson<{ envelopes: V2Envelope[] }>(response)
}

export async function apiAckInbox(envelopeIds: string[]) {
  const response = await authorizedFetch("/api/v2/direct/ack", {
    method: "POST",
    body: JSON.stringify({ envelopeIds }),
  })
  return await parseJson<{ ok: true }>(response)
}

export async function apiCreateGroup(title: string, memberUserIds: string[]) {
  const response = await authorizedFetch("/api/v2/groups/create", {
    method: "POST",
    body: JSON.stringify({ title, memberUserIds }),
  })
  return await parseJson<{ group: V2GroupRecord }>(response)
}

export async function apiListMyGroups() {
  const response = await authorizedFetch("/api/v2/groups/mine")
  return await parseJson<{ groups: V2GroupRecord[] }>(response)
}

export async function apiGetGroup(groupId: string) {
  const response = await authorizedFetch(`/api/v2/groups/${groupId}`)
  return await parseJson<{
    group: V2GroupRecord
    members: Array<{ userId: string; role: "owner" | "member"; active: boolean; joinedAt: number; groupId: string }>
  }>(response)
}

export async function apiAddGroupMembers(groupId: string, userIds: string[]) {
  const response = await authorizedFetch("/api/v2/groups/members/add", {
    method: "POST",
    body: JSON.stringify({ groupId, userIds }),
  })
  return await parseJson<{ group: V2GroupRecord }>(response)
}

export async function apiRemoveGroupMembers(groupId: string, userIds: string[]) {
  const response = await authorizedFetch("/api/v2/groups/members/remove", {
    method: "POST",
    body: JSON.stringify({ groupId, userIds }),
  })
  return await parseJson<{ group: V2GroupRecord }>(response)
}

export async function apiSendGroup(payload: {
  senderUserId: string
  senderDeviceId: number
  groupId: string
  epoch: number
  envelopes: Omit<Extract<V2Envelope, { kind: "group-message" | "group-key" }>, "envelopeId" | "groupId" | "epoch">[]
}) {
  const response = await authorizedFetch("/api/v2/groups/send", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return await parseJson<{ queued: V2Envelope[] }>(response)
}

export async function apiGetTransparency(userId: string) {
  const response = await fetch(apiUrl(`/api/v2/transparency/${userId}`))
  return await parseJson<{ head: string; events: V2TransparencyEvent[] }>(response)
}

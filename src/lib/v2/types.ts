export type V2PublicOneTimePreKey = {
  id: number
  publicKey: string
}

export type V2SignedPreKeyPublic = {
  id: number
  publicKey: string
  signature: string
}

export type V2KyberPreKeyPublic = {
  id: number
  publicKey: string
  signature: string
}

export type V2DeviceBundlePublic = {
  registrationId: number
  identityKey: string
  signedPreKey: V2SignedPreKeyPublic
  kyberPreKey: V2KyberPreKeyPublic
  oneTimePreKeys: V2PublicOneTimePreKey[]
}

export type V2BootstrapRequest = {
  userId?: string
  linkToken?: string
  profileName: string
  deviceLabel: string
  bundle: V2DeviceBundlePublic
}

export type V2BootstrapResponse = {
  userId: string
  deviceId: number
  deviceAuthToken: string
  profileName: string
  deviceLabel: string
  transparencyHead: string
}

export type V2UserProfile = {
  userId: string
  profileName: string
  createdAt: number
}

export type V2DevicePublicRecord = {
  userId: string
  deviceId: number
  deviceLabel: string
  registrationId: number
  createdAt: number
  revokedAt: number | null
  identityKey: string
  signedPreKey: V2SignedPreKeyPublic
  kyberPreKey: V2KyberPreKeyPublic
}

export type V2DevicePrivateRecord = V2DevicePublicRecord & {
  authTokenHash: string
}

export type V2DeviceBundleClaim = {
  userId: string
  profileName: string
  device: V2DevicePublicRecord
  oneTimePreKey: V2PublicOneTimePreKey | null
}

export type V2TransparencyEventType =
  | "user.created"
  | "device.added"
  | "device.revoked"
  | "prekeys.refreshed"
  | "group.created"
  | "group.membership.changed"

export type V2TransparencyEvent = {
  eventId: string
  userId: string
  type: V2TransparencyEventType
  createdAt: number
  payload: Record<string, unknown>
  previousHash: string
  hash: string
}

export type V2DirectEnvelope = {
  envelopeId: string
  kind: "direct"
  conversationId: string
  peerUserId?: string
  senderUserId: string
  senderDeviceId: number
  recipientUserId: string
  recipientDeviceId: number
  ciphertextType: "prekey" | "whisper"
  ciphertext: string
  sentAt: number
  clientMessageId: string
}

export type V2GroupEnvelope = {
  envelopeId: string
  kind: "group-message" | "group-key"
  groupId: string
  epoch: number
  distributionId?: string
  senderUserId: string
  senderDeviceId: number
  recipientUserId: string
  recipientDeviceId: number
  ciphertextType: "prekey" | "whisper" | "sender-key"
  ciphertext: string
  sentAt: number
  clientMessageId: string
}

export type V2Envelope = V2DirectEnvelope | V2GroupEnvelope

export type V2DirectSendRequest = {
  senderUserId: string
  senderDeviceId: number
  recipientUserId: string
  envelopes: Omit<V2DirectEnvelope, "envelopeId">[]
}

export type V2GroupRecord = {
  groupId: string
  title: string
  createdAt: number
  createdByUserId: string
  createdByDeviceId: number
  currentEpoch: number
}

export type V2GroupMembership = {
  groupId: string
  userId: string
  joinedAt: number
  role: "owner" | "member"
  active: boolean
}

export type V2GroupSendRequest = {
  senderUserId: string
  senderDeviceId: number
  groupId: string
  epoch: number
  envelopes: Omit<V2GroupEnvelope, "envelopeId" | "groupId" | "epoch">[]
}

export type V2ConversationMessage = {
  id: string
  conversationId: string
  fromUserId: string
  fromDeviceId: number
  toUserId?: string
  groupId?: string
  direction: "incoming" | "outgoing"
  plaintext: string
  sentAt: number
  kind: "direct" | "group"
}

export type V2LinkTokenRecord = {
  token: string
  userId: string
  issuedByDeviceId: number
  expiresAt: number
}

export type V2MeResponse = {
  profile: V2UserProfile
  devices: V2DevicePublicRecord[]
  transparencyHead: string
}

export type V2LocalDeviceState = {
  userId: string
  deviceId: number
  profileName: string
  deviceLabel: string
  deviceAuthToken: string
  registrationId: number
  identityPublicKey: string
  identityPrivateKey: string
  nextPreKeyId: number
  nextSignedPreKeyId: number
  nextKyberPreKeyId: number
  createdAt: number
}

export type V2ContactRecord = {
  userId: string
  profileName: string
  identityKeys: string[]
  lastSeenAt: number
  verifiedFingerprint: string | null
}

export type V2ConversationRecord = {
  conversationId: string
  kind: "direct" | "group"
  title: string
  counterpartUserId?: string
  counterpartProfileName?: string
  groupId?: string
  distributionId?: string
  epoch?: number
  lastMessageAt: number
}

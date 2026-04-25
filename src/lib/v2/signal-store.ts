import { idbDelete, idbGet, idbGetEntriesByPrefix, idbPut } from "./idb"
import type { V2LocalDeviceState } from "./types"

const LOCAL_DEVICE_META_KEY = "local-device"

function sessionKey(userId: string, deviceId: number) {
  return `${userId}:${deviceId}`
}

function senderKeyKey(userId: string, deviceId: number, distributionId: string) {
  return `${userId}:${deviceId}:${distributionId}`
}

export async function getLocalDeviceState() {
  return await idbGet<V2LocalDeviceState>("meta", LOCAL_DEVICE_META_KEY)
}

export async function setLocalDeviceState(state: V2LocalDeviceState) {
  await idbPut("meta", LOCAL_DEVICE_META_KEY, state)
}

export async function clearLocalDeviceState() {
  await idbDelete("meta", LOCAL_DEVICE_META_KEY)
}

export async function storePreKeyRecord(id: number, recordBase64: string) {
  await idbPut("prekeys", String(id), recordBase64)
}

export async function listPreKeyRecords() {
  return await idbGetEntriesByPrefix<string>("prekeys", "")
}

export async function deletePreKeyRecord(id: number) {
  await idbDelete("prekeys", String(id))
}

export async function storeSignedPreKeyRecord(id: number, recordBase64: string) {
  await idbPut("signedPrekeys", String(id), recordBase64)
}

export async function listSignedPreKeyRecords() {
  return await idbGetEntriesByPrefix<string>("signedPrekeys", "")
}

export async function storeKyberPreKeyRecord(id: number, recordBase64: string) {
  await idbPut("kyberPreKeys", String(id), recordBase64)
}

export async function listKyberPreKeyRecords() {
  return await idbGetEntriesByPrefix<string>("kyberPreKeys", "")
}

export async function storeSessionRecord(userId: string, deviceId: number, recordBase64: string) {
  await idbPut("sessions", sessionKey(userId, deviceId), recordBase64)
}

export async function listSessionRecords() {
  return await idbGetEntriesByPrefix<string>("sessions", "")
}

export async function storeSenderKeyRecord(userId: string, deviceId: number, distributionId: string, recordBase64: string) {
  await idbPut("senderKeys", senderKeyKey(userId, deviceId, distributionId), recordBase64)
}

export async function listSenderKeyRecords() {
  return await idbGetEntriesByPrefix<string>("senderKeys", "")
}

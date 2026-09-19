import { makeCacheableSignalKeyStore } from "@whiskeysockets/baileys"
export function getAuthOptions(state) {
  return {
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, console.log)
    }
  }
}

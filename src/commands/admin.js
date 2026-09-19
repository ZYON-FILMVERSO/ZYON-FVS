import fs from "fs"
import { setGrupoActivo } from "../modules/history.manager.js"
import { isOwner, addOwnerDb, delOwnerDb, getOwners } from "../utils/isOwner.js"
import config from "../core/config.js"
import { downloadMediaMessage } from "@whiskeysockets/baileys"

export async function cmdOn(sock, grupoId) {
  setGrupoActivo(grupoId, true)
  await sock.sendMessage(grupoId, { text: `✅ ${config.BOT_NAME} AUTOMÁTICO ON - 6am a 12am` })
}
export async function cmdOff(sock, grupoId) {
  setGrupoActivo(grupoId, false)
  await sock.sendMessage(grupoId, { text: `❌ ${config.BOT_NAME} OFF` })
}

export async function cmdAddOwner(sock, grupoId, senderId, args) {
  if (!isOwner(senderId)) return sock.sendMessage(grupoId, { text: "⛔ Solo owners y el bot pueden usar esto." })
  const numero = args[0]?.replace(/[^0-9]/g, "")
  if (!numero) return sock.sendMessage(grupoId, { text: "Usa: addowner 51912345678" })
  if (addOwnerDb(numero)) {
    await sock.sendMessage(grupoId, { text: `✅ Owner agregado: ${numero}` })
  } else {
    await sock.sendMessage(grupoId, { text: `⚠️ Ya es owner: ${numero}` })
  }
}

export async function cmdDelOwner(sock, grupoId, senderId, args) {
  if (!isOwner(senderId)) return
  const numero = args[0]?.replace(/[^0-9]/g, "")
  if (delOwnerDb(numero)) {
    await sock.sendMessage(grupoId, { text: `🗑️ Owner eliminado: ${numero}` })
  }
}

export async function cmdListOwner(sock, grupoId, senderId) {
  if (!isOwner(senderId)) return
  const { owners } = getOwners()
  await sock.sendMessage(grupoId, { text: `👑 *OWNERS ZYON-FVS™*\n\n${owners.map(o => `- ${o}`).join("\n")}` })
}

export async function cmdSetImg(sock, grupoId, senderId, message) {
  if (!isOwner(senderId)) return sock.sendMessage(grupoId, { text: "⛔ Solo owners y bot." })

  const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const mediaMsg = quoted?.imageMessage? { message: quoted } : null
  const directImg = message.message?.imageMessage? message : null
  const target = directImg || mediaMsg

  if (!target) return sock.sendMessage(grupoId, { text: "❌ Responde a una imagen con: setimg" })

  try {
    const buffer = await downloadMediaMessage(target, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage })
    fs.writeFileSync("./src/assets/menu.jpg", buffer)
    fs.writeFileSync("./src/assets/logo.jpg", buffer) // también actualiza logo si quieres
    await sock.sendMessage(grupoId, { image: buffer, caption: `✅ *Imagen de menú actualizada*\nAhora esta imagen se usará en el menú.` })
  } catch (e) {
    await sock.sendMessage(grupoId, { text: "Error al guardar imagen: " + e.message })
  }
}

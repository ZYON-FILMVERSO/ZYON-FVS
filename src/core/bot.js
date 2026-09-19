import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys"
import { Boom } from "@hapi/boom"
import fs from "fs"
import config from "./config.js"
import { getAuthOptions } from "./connection.js"
import { logger } from "../utils/logger.js"
import { iniciarCron } from "../cron/autoSender.js"

// Comandos
import { cmdEfemerides } from "../commands/efemerides.js"
import { cmdHelp } from "../commands/help.js"
import { cmdOn, cmdOff, cmdAddOwner, cmdDelOwner, cmdListOwner, cmdSetImg } from "../commands/admin.js"

export async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")
  const { auth } = getAuthOptions(state)

  const sock = makeWASocket({
    auth,
    printQRInTerminal: true,
    defaultQueryTimeoutMs: undefined,
    browser: [config.BOT_NAME, "Chrome", "1.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  // Conexión
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom? lastDisconnect.error.output.statusCode : 0)!== DisconnectReason.loggedOut
      logger.error(`Conexión cerrada. Reconectando: ${shouldReconnect}`)
      if (shouldReconnect) iniciarBot()
    }
    if (connection === "open") {
      logger.success(`${config.BOT_NAME} CONECTADO ✅`)

      // Poner logo como foto de perfil
      try {
        if (fs.existsSync("./src/assets/logo.jpg")) {
          await sock.updateProfilePicture(sock.user.id, { url: "./src/assets/logo.jpg" })
          logger.success("Logo ZYON-FVS™ puesto como perfil")
        }
      } catch (e) {
        logger.error("No se pudo poner logo: " + e.message)
      }

      iniciarCron(sock)
    }
  })

  // Escuchar mensajes
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const m = messages[0]
      if (!m.message) return
      if (m.key.fromMe) return

      const grupoId = m.key.remoteJid
      const isGroup = grupoId.endsWith("@g.us")
      const senderId = m.key.participant || m.key.remoteJid

      // Extraer texto
      const msgType = Object.keys(m.message)[0]
      let text = ""
      if (msgType === "conversation") text = m.message.conversation
      else if (msgType === "extendedTextMessage") text = m.message.extendedTextMessage.text
      else if (msgType === "imageMessage") text = m.message.imageMessage.caption || ""
      else return

      text = text.toLowerCase().trim()
      if (!text) return

      const args = text.split(" ")
      const cmd = args[0].replace(config.PREFIX, "")

      logger.info(`[${grupoId}] ${senderId}: ${text}`)

      // COMANDOS ADMIN - SOLO OWNER Y BOT
      if (text.startsWith("efemerides on")) { await cmdOn(sock, grupoId); return }
      if (text.startsWith("efemerides off")) { await cmdOff(sock, grupoId); return }

      if (cmd === "addowner") { await cmdAddOwner(sock, grupoId, senderId, args.slice(1)); return }
      if (cmd === "delowner") { await cmdDelOwner(sock, grupoId, senderId, args.slice(1)); return }
      if (cmd === "listowner" || cmd === "owners") { await cmdListOwner(sock, grupoId, senderId); return }
      if (cmd === "setimg" || cmd === "setmenu") { await cmdSetImg(sock, grupoId, senderId, m); return }

      // COMANDOS NORMALES
      if (["hoy", "dia", "efemerides", "efemérides", "menu", "help", "ayuda"].includes(cmd)) {
        if (cmd === "menu" || cmd === "help" || cmd === "ayuda") {
          await cmdHelp(sock, grupoId)
          return
        }
        try {
          await sock.sendMessage(grupoId, { text: "🔍 *Buscando efeméride en Wikipedia...*" })
          await cmdEfemerides(sock, grupoId)
        } catch (e) {
          logger.error(e.message)
          await sock.sendMessage(grupoId, { text: "❌ Error al buscar efeméride, intenta de nuevo." })
        }
        return
      }

    } catch (e) {
      logger.error("Error en messages.upsert: " + e.message)
    }
  })
}

import { cmdOn, cmdOff, cmdAddOwner, cmdDelOwner, cmdListOwner, cmdSetImg } from "../commands/admin.js"
import { cmdEfemerides } from "../commands/efemerides.js"
import { cmdHelp } from "../commands/help.js"
import { isOwner } from "../utils/isOwner.js"
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys"
import pino from "pino"
import { obtenerEfemerideUnica } from "../modules/efemerides.service.js"
import { formatearEfemeride } from "../modules/formatter.js"
import { getHistorial, addHistorial, setGrupoActivo } from "../modules/history.manager.js"
import { iniciarCron } from "../cron/autoSender.js"
import config from "./config.js"

export async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")
  const sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }) })
  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection }) => {
    if (connection === "open") {
      console.log(`✅ ${config.BOT_NAME} CONECTADO`)
      iniciarCron(sock)
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message) return
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase().trim()
    const grupoId = m.key.remoteJid
    const esGrupo = grupoId.endsWith("@g.us")

    // Comandos admin
    if (text === "efemerides on" || text === "efemérides on") {
      if (!esGrupo) return
      setGrupoActivo(grupoId, true)
      await sock.sendMessage(grupoId, { text: `✅ *${config.BOT_NAME}*\n\n⏰ Efemérides automáticas ACTIVADAS\n🕕 De 6am a 12am cada 1 hora\n📜 Sin repetir` })
      return
    }
    if (text === "efemerides off" || text === "efemérides off") {
      if (!esGrupo) return
      setGrupoActivo(grupoId, false)
      await sock.sendMessage(grupoId, { text: `❌ *${config.BOT_NAME}*\n\nEfemérides automáticas DESACTIVADAS` })
      return
    }

    // Comandos usuarios: hoy, dia, efemerides
    if (["hoy","dia","día","efemerides","efemérides"].includes(text)) {
      await sock.sendMessage(grupoId, { text: "🔍 Buscando en Wikipedia..." })
      const historial = getHistorial(grupoId)
      const efem = await obtenerEfemerideUnica(historial)
      if (!efem) return sock.sendMessage(grupoId, { text: "No encontré efeméride, intenta de nuevo" })

      const texto = formatearEfemeride(efem)

      if (efem.mediaUrl) {
        if (efem.isVideo) {
          await sock.sendMessage(grupoId, { video: { url: efem.mediaUrl }, caption: texto })
        } else {
          await sock.sendMessage(grupoId, { image: { url: efem.mediaUrl }, caption: texto })
        }
      } else {
        await sock.sendMessage(grupoId, { text: texto })
      }
      addHistorial(grupoId, efem.id)
    }
  })
}

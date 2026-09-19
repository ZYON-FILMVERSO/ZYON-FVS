import pkg from "@whiskeysockets/baileys"
const makeWASocket = pkg.default || pkg.makeWASocket
const useMultiFileAuthState = pkg.useMultiFileAuthState
const DisconnectReason = pkg.DisconnectReason
const fetchLatestBaileysVersion = pkg.fetchLatestBaileysVersion
import pino from "pino"
import fs from "fs"
import axios from "axios"
import moment from "moment-timezone"
import { OWNER, PREFIX, BOT_NAME, TIMEZONE } from "./config.js"
import express from "express"
import QRCode from "qrcode"

const app = express()
const PORT = process.env.PORT || 3000
let lastQR = null
let lastCode = null
let estado = "Iniciando..."

console.log("PASO 1: Imports OK - YO SOY YO BAILEYS v2.0")

app.get("/", async (req, res) => {
  let qrImg = ""
  if (lastQR) qrImg = await QRCode.toDataURL(lastQR)
  res.send(`
  <html><head><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="3">
  <style>body{background:#0f0f0f;color:#fff;font-family:sans-serif;text-align:center;padding:15px}
 .box{background:#1f1f1f;padding:20px;border-radius:20px;max-width:380px;margin:auto;border:1px solid #333}
  code{font-size:30px;letter-spacing:4px;background:#000;padding:12px;border-radius:10px;display:block;margin:15px 0;color:#25D366;font-weight:bold}
  img{background:#fff;padding:10px;border-radius:10px}</style></head><body>
  <div class="box"><h2 style="color:#25D366">${BOT_NAME}</h2><p>${estado}</p>
  ${lastCode? `<p>CODIGO:</p><code>${lastCode}</code><small>WhatsApp > Dispositivos vinculados > Vincular con número</small>` : `<p>Generando código...</p>`}
  ${qrImg? `<hr><p>QR:</p><img src="${qrImg}" width="260"/>` : ``}
  <br><br><a href="/reset" style="color:#ff4444;text-decoration:none">❌ Borrar sesión</a>
  </div></body></html>`)
})

app.get("/reset", (req, res) => {
  fs.rmSync("./session", { recursive: true, force: true })
  lastQR = null; lastCode = null; estado = "Reiniciando..."
  res.redirect("/")
  setTimeout(() => startBot(), 2000)
})

app.listen(PORT, () => console.log(`WEB corriendo en puerto ${PORT}`))

async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("./session")
    const { version } = await fetchLatestBaileysVersion()
    console.log(`Baileys v${version.join(".")} OK`)

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: [BOT_NAME, "Chrome", "1.0"],
      printQRInTerminal: false
    })

    if (!state.creds.registered) {
      estado = "Esperando para generar código..."
      setTimeout(async () => {
        try {
          const num = OWNER[0].replace(/[^0-9]/g, "")
          console.log(`Pidiendo código para ${num}...`)
          const code = await sock.requestPairingCode(num)
          lastCode = code
          estado = `Código para ${num}`
          console.log(`CODIGO: ${code}`)
        } catch (e) {
          estado = "Error código: " + e.message
          console.log(estado)
        }
      }, 4000)
    } else {
      estado = "Sesión encontrada, conectando..."
    }

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (u) => {
      const { connection, qr, lastDisconnect } = u
      if (qr) { lastQR = qr; estado = "Escanea el QR en la web" }
      if (connection === "open") {
        estado = "✅ CONECTADO!"
        lastQR = null; lastCode = null
        console.log("✅ CONECTADO")
      }
      if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
        if (shouldReconnect) { estado = "Desconectado, reconectando..."; setTimeout(startBot, 3000) }
        else estado = "Sesión cerrada, borra sesión"
      }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
      const m = messages[0]
      if (!m?.message || m.key.fromMe) return
      const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
      if (!text.startsWith(PREFIX)) return
      if (text.toLowerCase() === `${PREFIX}ping`) {
        await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! Bot activo" })
      }
    })

  } catch (e) {
    console.log("ERROR:", e)
    estado = "Error: " + e.message
  }
}

startBot()

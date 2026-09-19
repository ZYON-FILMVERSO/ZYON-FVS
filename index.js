import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys"
import pino from "pino"
import fs from "fs"
import axios from "axios"
import moment from "moment-timezone"
import { OWNER, PREFIX, BOT_NAME } from "./config.js"

let db = fs.existsSync("./database.json")? JSON.parse(fs.readFileSync("./database.json")) : { inmunes: [], warns: {}, contador: {}, config: { bienvenida: true, antilink: false, efemerides: false } }
const save = () => fs.writeFileSync("./database.json", JSON.stringify(db, null, 2))

async function getEfemerides() {
  try {
    const hoy = moment().tz("America/Lima")
    const dia = hoy.format("D")
    const mes = hoy.format("M")
    const res = await axios.get(`https://es.wikipedia.org/api/rest_v1/feed/onthisday/events/${mes}/${dia}`, { headers: { "User-Agent": "ZYON-FVS" } })
    const eventos = res.data.events.slice(0, 3).map(e => `• ${e.year}: ${e.text}`).join("\n")
    return `📅 *EFEMÉRIDES DE HOY - ${hoy.format("DD/MM")}*\n\n${eventos}\n\n— ${BOT_NAME} —`
  } catch { return "📅 Hoy no se pudieron cargar las efemérides." }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session")
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), printQRInTerminal: true, browser: [BOT_NAME, "Chrome", "1.0"] })
  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", async (u) => {
    if(u.connection === "open") {
      console.log(`✅ ${BOT_NAME} ONLINE`)
      if(db.config.efemerides) {
        const ef = await getEfemerides()
        const groups = Object.keys(db.contador)
        for(let g of groups) { await sock.sendMessage(g, { text: ef }) }
      }
    }
    if(u.connection === "close" && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]; if(!m.message || m.key.fromMe) return
    const from = m.key.remoteJid; const isGroup = from.endsWith("@g.us")
    const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
    if(!body.startsWith(PREFIX)) return
    const sender = m.key.participant || from
    if(isGroup) {
      const meta = await sock.groupMetadata(from)
      const admins = meta.participants.filter(p=>p.admin).map(p=>p.id)
      const isAdmin = admins.includes(sender) || OWNER.includes(sender)
      if(!isAdmin) return
      // Inmunidad check
      if(db.inmunes?.includes(sender) && body.includes("!kick")) return
      // Antilink
      if(db.config.antilink && body.match(/https:\/\/chat.whatsapp.com/)) {
        if(!db.inmunes.includes(sender)) await sock.sendMessage(from, { delete: m.key })
      }
    }

    const args = body.slice(1).trim().split(/ +/); const cmd = args.shift().toLowerCase()

    if(cmd === "menu") {
      const menu = `🤖━━━━━━━━━━━━━━━━━━━━━🤖\n ⚡ ${BOT_NAME} ⚡\n🤖━━━━━━━━━━━━━━━━━━━━━🤖\n\n👑 *ADMIN:*!kick @user → Expulsa\n!mute @user → Silencia\n!unmute @user → Quita silencio\n!promote @user → Da admin\n!demote @user → Quita admin\n!add <num> → Agrega\n!ban/@unban → Banea\n!warn @user → Adv (3=kick)\n!tagall /!hidetag → Menciona\n!link → Link grupo\n!del → Borra mensaje (responde a él)\n\n🛡️ *INMUNIDAD:*!inmunidad @user → Protege\n!delinmunidad @user → Quita\n!inmunes → Lista\n\n📊 *INFO:*!activos!inactivos!miembros!info!stats!top!aportes\n🔐 *GRUPO:*!abrir!cerrar!abrir 10s!cerrar 1h!horario 6am 10pm!aceptar on/off\n⚙️ *CONFIG:*!prefix!antilink on/off!bienvenida on/off!despedida on/off!efemerides on/off\n\n!menu → este menú`
      await sock.sendMessage(from, { text: menu }, { quoted: m })
    }

    if(cmd === "del" && m.message.extendedTextMessage?.contextInfo?.stanzaId) {
      const q = m.message.extendedTextMessage.contextInfo
      await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: q.stanzaId, participant: q.participant } })
    }

    if(cmd === "inmunidad") {
      const jid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      if(jid) { db.inmunes = [...new Set([...(db.inmunes||[]), jid])]; save(); await sock.sendMessage(from, { text: `🛡️ @${jid.split("@")[0]} ahora es inmune`, mentions: [jid] }) }
    }
    if(cmd === "delinmunidad" || cmd === "quitarinmunidad") {
      const jid = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
      if(jid) { db.inmunes = db.inmunes.filter(x=>x!==jid); save(); await sock.sendMessage(from, { text: `🛡️ Inmunidad quitada` }) }
    }
    if(cmd === "inmunes") {
      const list = (db.inmunes||[]).map((j,i)=>`${i+1}. @${j.split("@")[0]}`).join("\n")
      await sock.sendMessage(from, { text: `🛡️ *INMUNES:*\n${list||"Nadie"}`, mentions: db.inmunes })
    }

    if(cmd === "efemerides") {
      const e = await getEfemerides()
      await sock.sendMessage(from, { text: e }, { quoted: m })
    }

    if(cmd === "abrir") await sock.groupSettingUpdate(from, "not_announcement")
    if(cmd === "cerrar") await sock.groupSettingUpdate(from, "announcement")
    if(cmd === "link") { const code = await sock.groupInviteCode(from); await sock.sendMessage(from, { text: `🔗 https://chat.whatsapp.com/${code}` }) }
  })
}
startBot()

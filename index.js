import pkg from "@whiskeysockets/baileys"
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = pkg
import pino from "pino"
import fs from "fs"
import axios from "axios"
import moment from "moment-timezone"
import { OWNER, PREFIX, BOT_NAME, TIMEZONE } from "./config.js"

let db = {}
try { if(fs.existsSync("./database.json")) db = JSON.parse(fs.readFileSync("./database.json")) } catch {}
db.inmunes = db.inmunes || []
db.warns = db.warns || {}
db.banned = db.banned || []
db.muted = db.muted || {}
db.contador = db.contador || {}
db.config = db.config || { bienvenida: true, despedida: true, antilink: false, antispam: false, efemerides: true, aceptar: false }
db.horarios = db.horarios || {}
const save = () => fs.writeFileSync("./database.json", JSON.stringify(db, null, 2))

function ms(str){
  if(!str) return 0
  const num = parseInt(str)
  if(str.endsWith("s")) return num*1000
  if(str.endsWith("m")) return num*60000
  if(str.endsWith("h")) return num*3600000
  if(str.endsWith("d")) return num*86400000
  return num*1000
}
async function getEfemerides(){
  try{
    const hoy = moment().tz(TIMEZONE)
    const dia = hoy.format("D"); const mes = hoy.format("M")
    const url = `https://es.wikipedia.org/api/rest_v1/feed/onthisday/events/${mes}/${dia}`
    const res = await axios.get(url, { headers: { "User-Agent": BOT_NAME } })
    const ev = res.data.events.slice(0,5).map(e=>`• *${e.year}*: ${e.text}`).join("\n")
    return `📅 *EFEMÉRIDES DE HOY - ${hoy.format("DD [de] MMMM YYYY")}*\n\n${ev}\n\n— ${BOT_NAME} —`
  }catch{ return "📅 No se pudo cargar efemérides hoy." }
}
function getMenu(){
return `🤖━━━━━━━━━━━━━━━━━━━━━🤖
   ⚡ ZYON-FVS™ ⚡
🤖━━━━━━━━━━━━━━━━━━━━━🤖

👑 ADMIN:!kick!mute!unmute!promote!demote!add!ban!unban!warn!tagall!hidetag!link!del
🛡️ INMUNIDAD:!inmunidad @user!delinmunidad!inmunes
📊 INFO:!activos!inactivos!miembros!info!top
🔐 GRUPO:!abrir!cerrar!abrir 10s!cerrar 1h
⚙️ CONFIG:!antilink on/off!bienvenida on/off!despedida on/off!efemerides on/off

!menu → este menú`
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState("./session")
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }), browser: [BOT_NAME, "Chrome", "1.0"] })

  if(!fs.existsSync("./session/creds.json")){
    setTimeout(async()=>{
      try{
        const code = await sock.requestPairingCode(OWNER[0].split("@")[0].replace(/[^0-9]/g,""))
        console.log(`\n==========================\nCODIGO DE VINCULACION: ${code}\n==========================\n`)
      }catch(e){ console.log("Error pidiendo codigo:", e.message) }
    }, 3000)
  }

  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", async (u)=>{
    if(u.connection==="open"){ console.log(`✅ ${BOT_NAME} CONECTADO`) }
    if(u.connection==="close" && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut){ startBot() }
  })

  sock.ev.on("messages.upsert", async ({ messages })=>{
    const m = messages[0]; if(!m.message || m.key.fromMe) return
    const from = m.key.remoteJid; const isGroup = from.endsWith("@g.us")
    const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
    if(!body) return
    if(isGroup){
      db.contador[from]=db.contador[from]||{}
      const sender = m.key.participant || from
      db.contador[from][sender]=(db.contador[from][sender]||0)+1; save()
      if(db.muted[from]?.includes(sender)){ try{ await sock.sendMessage(from, { delete: m.key }) }catch{}; return }
    }
    if(!body.startsWith(PREFIX)) return
    const sender = m.key.participant || from
    let meta, admins, isAdmin
    if(isGroup){
      meta = await sock.groupMetadata(from)
      admins = meta.participants.filter(p=>p.admin).map(p=>p.id)
      isAdmin = admins.includes(sender) || OWNER.includes(sender)
      if(!isAdmin) return
    }
    const args = body.slice(PREFIX.length).trim().split(/ +/); const cmd = args.shift().toLowerCase()
    const q = m.message.extendedTextMessage?.contextInfo; const mentioned = q?.mentionedJid || []
    const getUser = () => mentioned[0] || null

    if(cmd==="menu"||cmd==="help"||cmd==="comandos") await sock.sendMessage(from, { text: getMenu() }, { quoted: m })
    if((cmd==="del"||cmd==="delete") && q?.stanzaId) await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: q.stanzaId, participant: q.participant } })
    if(cmd==="kick" && isGroup){ const u=getUser(); if(u &&!db.inmunes.includes(u)) await sock.groupParticipantsUpdate(from, [u], "remove") }
    if(cmd==="add" && isGroup){ const num=args[0]?.replace(/[^0-9]/g,"")+"@s.whatsapp.net"; if(num) await sock.groupParticipantsUpdate(from, [num], "add") }
    if(cmd==="promote" && isGroup){ const u=getUser(); if(u) await sock.groupParticipantsUpdate(from, [u], "promote") }
    if(cmd==="demote" && isGroup){ const u=getUser(); if(u) await sock.groupParticipantsUpdate(from, [u], "demote") }
    if(cmd==="mute" && isGroup){ const u=getUser(); if(u){ db.muted[from]=db.muted[from]||[]; if(!db.muted[from].includes(u)){ db.muted[from].push(u); save(); await sock.sendMessage(from, { text:`🔇 Mute @${u.split("@")[0]}`, mentions:[u] }) } } }
    if(cmd==="unmute" && isGroup){ const u=getUser(); if(u){ db.muted[from]=(db.muted[from]||[]).filter(x=>x!==u); save(); await sock.sendMessage(from, { text:`🔊 Unmute @${u.split("@")[0]}`, mentions:[u] }) } }
    if(cmd==="hidetag" && isGroup){ const txt=args.join(" ")||"📢 Atención"; await sock.sendMessage(from, { text: txt, mentions: meta.participants.map(p=>p.id) }) }
    if(cmd==="tagall" && isGroup){ let t=`${args.join(" ")||"📢 Atención"}\n\n`; meta.participants.forEach(p=>{ t+=`@${p.id.split("@")[0]} ` }); await sock.sendMessage(from, { text: t, mentions: meta.participants.map(p=>p.id) }) }
    if(cmd==="link" && isGroup){ const code=await sock.groupInviteCode(from); await sock.sendMessage(from, { text:`🔗 https://chat.whatsapp.com/${code}` }) }
    if(cmd==="abrir" && isGroup){ await sock.groupSettingUpdate(from, "not_announcement") }
    if(cmd==="cerrar" && isGroup){ await sock.groupSettingUpdate(from, "announcement") }
    if(cmd==="inmunidad"){ const u=getUser(); if(u){ db.inmunes=[...new Set([...db.inmunes, u])]; save(); await sock.sendMessage(from, { text:`🛡️ Inmune @${u.split("@")[0]}`, mentions:[u] }) } }
    if(cmd==="delinmunidad"){ const u=getUser(); if(u){ db.inmunes=db.inmunes.filter(x=>x!==u); save() } }
    if(cmd==="inmunes"){ const list=db.inmunes.map((j,i)=>`${i+1}. @${j.split("@")[0]}`).join("\n"); await sock.sendMessage(from, { text:`🛡️ INMUNES:\n${list||"Nadie"}`, mentions: db.inmunes }) }
    if(cmd==="efemerides"){ const e=await getEfemerides(); await sock.sendMessage(from, { text:e }) }
  })
}
startBot()

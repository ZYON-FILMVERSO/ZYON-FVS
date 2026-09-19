import Baileys from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = Baileys;
import pino from 'pino';
import fs from 'fs';
import cron from 'node-cron';
import express from 'express';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import 'dotenv/config';

// ==================================================================
// CONFIG GENERAL
// ==================================================================
const DATA_DIR = process.env.DATA_DIR || './data';
const AUTH_DIR = `${DATA_DIR}/auth_info_baileys`;
const DB_FILE = `${DATA_DIR}/database.json`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// ------------------------------------------------------------------
// SERVIDOR WEB
// ------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 10000;
let botOnline = false;

app.get('/', (req, res) =>
  res.send(`⚡ ZYON-FVS™ ${botOnline ? 'ONLINE ✅' : 'CONECTANDO... ⏳'} ⚡`)
);
app.get('/health', (req, res) => res.json({ online: botOnline }));
app.listen(PORT, () => console.log(`[SERVER] Escuchando en el puerto ${PORT}`));

// ------------------------------------------------------------------
// BASE DE DATOS LOCAL
// ------------------------------------------------------------------
let db = {
  mutes: [],
  baneados: [],
  antilink: { activo: true, maxAdv: 3 },
  antispam: { activo: false },
  bienvenida: { activo: true },
  despedida: { activo: true },
  efemerides: { activo: true },
  prefijo: '!',
  horarioApertura: null,
  horarioCierre: null,
  aceptarIntegrantes: false,
  usuarios: {},
  fechaReinicioMensajes: moment().startOf('week').toISOString(),
  fechaReinicioAportes: moment().toISOString()
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) };
  } catch {
    console.error('[DB] database.json corrupto');
  }
}

const saveDB = () => {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.error('[DB] error:', e.message); }
};

function getUserData(jid) {
  if (!db.usuarios[jid]) {
    db.usuarios[jid] = { 
      mensajes: 0, 
      aportes: 0, 
      advertencias: 0,
      ultimaActividad: new Date().toISOString()
    };
  }
  return db.usuarios[jid];
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ------------------------------------------------------------------
// EFEMÉRIDES (WIKIPEDIA)
// ------------------------------------------------------------------
async function getEfemerides() {
  const hoy = moment.tz('America/Lima');
  const mm = hoy.format('MM');
  const dd = hoy.format('DD');

  try {
    const res = await fetch(`https://es.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm}/${dd}`, {
      headers: { 'User-Agent': 'ZYON-FVS-Bot/2.0' }
    });
    if (!res.ok) throw new Error(`Wikipedia respondió ${res.status}`);
    const data = await res.json();

    const fechaBonita = hoy.locale('es').format('D [de] MMMM');
    let texto = `📅✨ *EFEMÉRIDES DEL ${fechaBonita.toUpperCase()}* ✨📅\n📚 _fuente: Wikipedia_\n\n`;

    if (data.events?.length) {
      texto += `🌍 *Pasó un día como hoy:* 🕰️\n`;
      data.events.slice(0, 2).forEach(e => texto += `▪️ ${e.year} ➜ ${e.text}\n`);
      texto += `\n`;
    }
    if (data.births?.length) {
      texto += `🎂 *Nacieron un día como hoy:* 👶\n`;
      data.births.slice(0, 2).forEach(e => texto += `▪️ ${e.year} ➜ ${e.text}\n`);
      texto += `\n`;
    }
    if (data.deaths?.length) {
      texto += `🕯️ *Fallecieron un día como hoy:* 🥀\n`;
      data.deaths.slice(0, 1).forEach(e => texto += `▪️ ${e.year} ➜ ${e.text}\n`);
    }

    return texto;
  } catch (e) {
    console.error('[EFEMERIDES ERROR]', e.message);
    return null;
  }
}

// ------------------------------------------------------------------
// MENÚ ADORNADO
// ------------------------------------------------------------------
function buildMenuText(p) {
  return `🤖━━━━━━━━━━━━━━━━━━━━━🤖
   ⚡ ZYON-FVS™ MENÚ ⚡
🤖━━━━━━━━━━━━━━━━━━━━━🤖

👑 *ADMIN:*
  ${p}kick @user
  ${p}mute @user
  ${p}unmute @user
  ${p}promote @user
  ${p}demote @user
  ${p}add <numero>
  ${p}ban @user
  ${p}unban @user
  ${p}warn @user <razon>
  ${p}tagall <texto>
  ${p}hidetag <texto>
  ${p}link

📊 *INFO:*
  ${p}activos
  ${p}inactivos
  ${p}miembros
  ${p}info
  ${p}stats @user
  ${p}top
  ${p}aportes

🔐 *GRUPO:*
  ${p}abrir / ${p}cerrar
  ${p}abrir 10s / ${p}cerrar 1h
  ${p}horario 6am 10pm
  ${p}aceptar on/off

⚙️ *CONFIG:*
  ${p}prefix <simbolo>
  ${p}antilink on/off
  ${p}antispam on/off
  ${p}bienvenida on/off
  ${p}despedida on/off
  ${p}efemerides on/off

📖 *INFO:*
  ${p}menu
  ${p}help
  ${p}comandos

🤖━━━━━━━━━━━━━━━━━━━━━🤖`;
}

// ------------------------------------------------------------------
// FUNCIONES DE GRUPO
// ------------------------------------------------------------------
async function isGroupAdmin(sock, groupJid, userJid) {
  try {
    const groupMetadata = await sock.groupMetadata(groupJid);
    const participant = groupMetadata.participants.find(p => p.id === userJid);
    return participant?.admin !== null;
  } catch {
    return false;
  }
}

async function isBotAdmin(sock, groupJid) {
  try {
    const groupMetadata = await sock.groupMetadata(groupJid);
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const bot = groupMetadata.participants.find(p => p.id === botId);
    return bot?.admin !== null;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// BOT PRINCIPAL
// ------------------------------------------------------------------
let reconnectTimer = null;
let shuttingDown = false;

async function startBot() {
  if (shuttingDown) return;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (e) {
    console.error('[VERSION] error:', e.message);
  }

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['ZYON-FVS™', 'chrome', '2.0.0'],
    auth: state
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
  });

  // ---------- Conexión ----------
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      botOnline = true;
      console.log('⚡ ZYON-FVS™ ONLINE Y LISTO EN EL BARRIO ⚡');
      return;
    }
    if (connection === 'close') {
      botOnline = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Logout manual.');
        return;
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(startBot, 5000);
    }
  });

  // ---------- Pairing Code ----------
  if (!sock.authState.creds.registered) {
    const phoneNumber = (process.env.BOT_NUMBER || '').replace(/[^0-9]/g, '');
    if (!phoneNumber) {
      console.error('⚠️ Falta BOT_NUMBER en .env');
      return;
    }
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n========================================`);
        console.log(`🔑 CÓDIGO DE VINCULACIÓN ZYON: ${code}`);
        console.log(`========================================\n`);
      } catch (e) {
        console.error('[PAIRING] error:', e.message);
      }
    }, 4000);
  }

  // ---------- Bienvenida ----------
  sock.ev.on('group-participants.update', async (anu) => {
    if (anu.action !== 'add') return;
    if (!db.bienvenida.activo) return;

    for (const user of anu.participants) {
      let msg = `🎉━━━━━━━━━━━━━━━━━━🎉\n`;
      msg += `   ¡BIENVENIDO AL GRUPO!\n`;
      msg += `   👋 @${user.split('@')[0]}\n`;
      msg += `   \n`;
      msg += `   Esperamos disfrutes aquí.\n`;
      msg += `   Lee las reglas y respeta a todos.\n`;
      msg += `🎉━━━━━━━━━━━━━━━━━━🎉`;
      
      await sock.sendMessage(anu.id, { text: msg, mentions: [user] }).catch(() => {});
    }
  });

  // ================= PROCESAMIENTO DE MENSAJES =================
  sock.ev.on('messages.upsert', async (m) => {
    for (const msg of m.messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) continue;

        const sender = msg.key.participant || from;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!body.trim()) continue;

        const prefix = db.prefijo || '!';
        const prefixEsc = escapeRegExp(prefix);

        // --- VERIFICAR SI ES ADMIN ---
        const isAdmin = await isGroupAdmin(sock, from, sender);
        
        if (!body.startsWith(prefix)) continue;
        if (!isAdmin) {
          await sock.sendMessage(from, { text: `⚠️ Solo administradores pueden usar comandos.`, quoted: msg });
          continue;
        }

        // --- CONTADORES ---
        const userData = getUserData(sender);
        userData.mensajes += 1;
        userData.ultimaActividad = new Date().toISOString();
        
        const type = Object.keys(msg.message)[0];
        if (['documentMessage', 'videoMessage'].includes(type)) {
          userData.aportes += 1;
        }
        saveDB();

        // --- PARSEAR COMANDO ---
        const args = body.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        const botAdmin = await isBotAdmin(sock, from);
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants;

        // --- COMANDOS ---
        switch (command) {
          case 'menu':
          case 'help':
          case 'comandos':
            await sock.sendMessage(from, { text: buildMenuText(prefix) }, { quoted: msg });
            break;

          case 'link':
            if (botAdmin) {
              const code = await sock.groupInviteCode(from);
              const groupName = groupMetadata.subject;
              let linkMsg = `🔗━━━━━━━━━━━━━━━━━━🔗\n`;
              linkMsg += `   ✨ ENLACE DEL GRUPO ✨\n`;
              linkMsg += `   📱 ${groupName}\n`;
              linkMsg += `🔗━━━━━━━━━━━━━━━━━━🔗\n\n`;
              linkMsg += `https://chat.whatsapp.com/${code}\n\n`;
              linkMsg += `¡Invita a tus amigos! 🎉`;
              await sock.sendMessage(from, { text: linkMsg });
            }
            break;

          case 'kick':
            if (mentioned && botAdmin) {
              await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
              await sock.sendMessage(from, { text: `🚪 @${mentioned.split('@')[0]} fue expulsado.`, mentions: [mentioned] });
            }
            break;

          case 'promote':
            if (mentioned && botAdmin) {
              await sock.groupParticipantsUpdate(from, [mentioned], 'promote');
              await sock.sendMessage(from, { text: `⬆️ @${mentioned.split('@')[0]} ahora es admin.`, mentions: [mentioned] });
            }
            break;

          case 'demote':
            if (mentioned && botAdmin) {
              await sock.groupParticipantsUpdate(from, [mentioned], 'demote');
              await sock.sendMessage(from, { text: `⬇️ @${mentioned.split('@')[0]} ya no es admin.`, mentions: [mentioned] });
            }
            break;

          case 'mute':
            if (mentioned) {
              if (!db.mutes.includes(mentioned)) {
                db.mutes.push(mentioned);
                saveDB();
                await sock.sendMessage(from, { text: `🔇 @${mentioned.split('@')[0]} silenciado.`, mentions: [mentioned] });
              }
            }
            break;

          case 'unmute':
            if (mentioned) {
              db.mutes = db.mutes.filter(id => id !== mentioned);
              saveDB();
              await sock.sendMessage(from, { text: `🔊 @${mentioned.split('@')[0]} desmuteado.`, mentions: [mentioned] });
            }
            break;

          case 'ban':
            if (mentioned) {
              if (!db.baneados.includes(mentioned) && botAdmin) {
                db.baneados.push(mentioned);
                saveDB();
                await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
                await sock.sendMessage(from, { text: `🚫 @${mentioned.split('@')[0]} baneado permanentemente.`, mentions: [mentioned] });
              }
            }
            break;

          case 'unban':
            if (mentioned) {
              db.baneados = db.baneados.filter(id => id !== mentioned);
              saveDB();
              await sock.sendMessage(from, { text: `✅ @${mentioned.split('@')[0]} desbaneado.`, mentions: [mentioned] });
            }
            break;

          case 'warn':
            if (mentioned) {
              const userData = getUserData(mentioned);
              userData.advertencias = (userData.advertencias || 0) + 1;
              saveDB();
              
              if (userData.advertencias >= 3) {
                if (botAdmin) await sock.groupParticipantsUpdate(from, [mentioned], 'remove');
                await sock.sendMessage(from, { text: `❌ @${mentioned.split('@')[0]} fue expulsado por 3 advertencias.`, mentions: [mentioned] });
              } else {
                await sock.sendMessage(from, { text: `⚠️ @${mentioned.split('@')[0]} advertencia (${userData.advertencias}/3).`, mentions: [mentioned] });
              }
            }
            break;

          case 'tagall':
            let textAll = `📢 *LLAMADO GENERAL*\n\n${args.join(' ')}\n\n`;
            participants.forEach(p => textAll += `@${p.id.split('@')[0]}\n`);
            await sock.sendMessage(from, { text: textAll, mentions: participants.map(p => p.id) });
            break;

          case 'hidetag':
            await sock.sendMessage(from, { text: args.join(' '), mentions: participants.map(p => p.id) });
            break;

          case 'add':
            if (args[0] && botAdmin) {
              const num = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
              await sock.groupParticipantsUpdate(from, [num], 'add').catch(() => {});
            }
            break;

          case 'activos':
            let actTxt = `📊 *USUARIOS ACTIVOS*\n\n`;
            Object.entries(db.usuarios)
              .sort((a, b) => b[1].mensajes - a[1].mensajes)
              .forEach(([jid, d]) => {
                if (d.mensajes > 0) actTxt += `@${jid.split('@')[0]}: ${d.mensajes} msgs\n`;
              });
            await sock.sendMessage(from, { text: actTxt || `No hay usuarios activos.`, mentions: Object.keys(db.usuarios) });
            break;

          case 'inactivos':
            const inactive = participants.filter(p => (db.usuarios[p.id]?.mensajes || 0) === 0).map(p => p.id);
            const inactTxt = `😴 *INACTIVOS (0 MSGS)*: ${inactive.length}\n\n${inactive.map(id => `@${id.split('@')[0]}`).join('\n')}`;
            await sock.sendMessage(from, { text: inactTxt, mentions: inactive });
            break;

          case 'aportes':
            let apTxt = `🎁 *USUARIOS CON APORTES*\n\n`;
            Object.entries(db.usuarios)
              .sort((a, b) => b[1].aportes - a[1].aportes)
              .forEach(([jid, d]) => {
                if (d.aportes > 0) apTxt += `@${jid.split('@')[0]}: ${d.aportes} archivos\n`;
              });
            await sock.sendMessage(from, { text: apTxt || `No hay aportes aún.`, mentions: Object.keys(db.usuarios) });
            break;

          case 'top':
            let topTxt = `🏆 *TOP 10 MENSAJES*\n\n`;
            Object.entries(db.usuarios)
              .sort((a, b) => b[1].mensajes - a[1].mensajes)
              .slice(0, 10)
              .forEach(([jid, d], i) => {
                const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}️⃣`;
                topTxt += `${emoji} @${jid.split('@')[0]}: ${d.mensajes} msgs\n`;
              });
            await sock.sendMessage(from, { text: topTxt });
            break;

          case 'stats':
            if (mentioned) {
              const stats = db.usuarios[mentioned] || { mensajes: 0, aportes: 0, advertencias: 0 };
              let statsTxt = `📊 *ESTADÍSTICAS*\n\n`;
              statsTxt += `👤 @${mentioned.split('@')[0]}\n`;
              statsTxt += `💬 Mensajes: ${stats.mensajes}\n`;
              statsTxt += `📦 Aportes: ${stats.aportes}\n`;
              statsTxt += `⚠️ Advertencias: ${stats.advertencias || 0}`;
              await sock.sendMessage(from, { text: statsTxt, mentions: [mentioned] });
            }
            break;

          case 'miembros':
            await sock.sendMessage(from, { text: `👥 *MIEMBROS DEL GRUPO*: ${participants.length}` });
            break;

          case 'info':
            let infoTxt = `ℹ️ *INFO DEL GRUPO*\n\n`;
            infoTxt += `📱 Nombre: ${groupMetadata.subject}\n`;
            infoTxt += `👥 Miembros: ${participants.length}\n`;
            infoTxt += `📅 Creado: ${new Date(groupMetadata.creation * 1000).toLocaleDateString('es-ES')}`;
            await sock.sendMessage(from, { text: infoTxt });
            break;

          case 'prefix':
          case 'setprefix':
            if (args[0]) {
              db.prefijo = args[0];
              saveDB();
              await sock.sendMessage(from, { text: `✅ Prefijo cambiado a: ${args[0]}` });
            }
            break;

          case 'antilink':
            if (args[0]) {
              db.antilink.activo = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Anti-link ${args[0].toUpperCase()}` });
            }
            break;

          case 'antispam':
            if (args[0]) {
              db.antispam.activo = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Anti-spam ${args[0].toUpperCase()}` });
            }
            break;

          case 'bienvenida':
            if (args[0]) {
              db.bienvenida.activo = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Bienvenida ${args[0].toUpperCase()}` });
            }
            break;

          case 'despedida':
            if (args[0]) {
              db.despedida.activo = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Despedida ${args[0].toUpperCase()}` });
            }
            break;

          case 'efemerides':
            if (args[0]) {
              db.efemerides.activo = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Efemérides ${args[0].toUpperCase()}` });
            }
            break;

          case 'abrir':
            if (botAdmin) {
              await sock.groupSettingUpdate(from, 'not_announcement');
              await sock.sendMessage(from, { text: `✅ Grupo abierto. Todos pueden escribir.` });
            }
            break;

          case 'cerrar':
            if (botAdmin) {
              await sock.groupSettingUpdate(from, 'announcement');
              await sock.sendMessage(from, { text: `🔒 Grupo cerrado. Solo admins pueden escribir.` });
            }
            break;

          case 'aceptar':
            if (args[0]) {
              db.aceptarIntegrantes = args[0].toLowerCase() === 'on';
              saveDB();
              await sock.sendMessage(from, { text: `✅ Aceptación de integrantes ${args[0].toUpperCase()}` });
            }
            break;

          case 'horario':
            if (args[0] && args[1]) {
              db.horarioApertura = args[0];
              db.horarioCierre = args[1];
              saveDB();
              await sock.sendMessage(from, { text: `✅ Horario configurado: ${args[0]} a ${args[1]}` });
            } else if (args[0] === 'off') {
              db.horarioApertura = null;
              db.horarioCierre = null;
              saveDB();
              await sock.sendMessage(from, { text: `❌ Horario desactivado.` });
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[MSG ERROR]', err.message);
      }
    }
  });
}

// ==================================================================
// TAREAS AUTOMÁTICAS
// ==================================================================
cron.schedule('0 0 * * 0', () => {
  db.usuarios = {};
  saveDB();
  console.log('[CRON] Contadores reiniciados (domingo 00:00)');
});

// ==================================================================
// ARRANQUE + CIERRE
// ==================================================================
process.on('unhandledRejection', (err) => console.error('[UNHANDLED]', err));
process.on('uncaughtException', (err) => console.error('[EXCEPTION]', err));

['SIGINT', 'SIGTERM'].forEach(sig => {
  process.on(sig, () => {
    console.log(`[SHUTDOWN] Recibido ${sig}, cerrando...`);
    shuttingDown = true;
    clearTimeout(reconnectTimer);
    process.exit(0);
  });
});

startBot().catch(e => {
  console.error('[FATAL]', e);
  setTimeout(startBot, 10000);
});

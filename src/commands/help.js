import config from "../core/config.js"
export async function cmdHelp(sock, grupoId) {
  await sock.sendMessage(grupoId, {
    text: `
╭─ ${config.BOT_NAME} ─╮
📜 *MENU EFEMÉRIDES*

*Para todos:*
• hoy - Efeméride de hoy
• dia - Efeméride random
• efemerides - Efeméride al azar con foto/video

*Solo admins:*
• efemerides on - Activa cada hora 6am-12am
• efemerides off - Desactiva

📹 Si la efeméride tiene video, se envía video.
📜 Textos largos y elegantes de Wikipedia ES

⚡ ${config.BOT_NAME} ⚡
╰─────────────╯`.trim()
  })
}

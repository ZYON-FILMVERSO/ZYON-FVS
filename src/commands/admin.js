import { setGrupoActivo } from "../modules/history.manager.js"
import config from "../core/config.js"

export async function cmdOn(sock, grupoId) {
  setGrupoActivo(grupoId, true)
  await sock.sendMessage(grupoId, {
    text: `╭─ ${config.BOT_NAME} ─╮\n✅ AUTOMÁTICO ACTIVADO\n\n⏰ Cada 1 hora\n🕕 De 6:00 AM a 12:00 AM\n📜 Efemérides únicas sin repetir\n📹 Si hay video, manda video\n\nEscribe *efemerides off* para apagar\n╰─ ${config.BOT_NAME} ─╯`
  })
}
export async function cmdOff(sock, grupoId) {
  setGrupoActivo(grupoId, false)
  await sock.sendMessage(grupoId, { text: `❌ ${config.BOT_NAME} desactivado en este grupo.` })
}

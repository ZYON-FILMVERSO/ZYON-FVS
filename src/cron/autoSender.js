import cron from "node-cron"
import { obtenerEfemerideUnica } from "../modules/efemerides.service.js"
import { formatearEfemeride } from "../modules/formatter.js"
import { getGrupos, getHistorial, addHistorial } from "../modules/history.manager.js"

export function iniciarCron(sock) {
  // Cada hora en punto
  cron.schedule('0 * * * *', async () => {
    const horaPeru = new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
    const hora = new Date(horaPeru).getHours()

    if (hora < 6 || hora >= 24) return // solo de 6am a 12am

    const grupos = getGrupos()
    for (const grupoId in grupos) {
      if (!grupos[grupoId].activo) continue

      const historial = getHistorial(grupoId)
      const efem = await obtenerEfemerideUnica(historial)
      if (!efem) continue

      const texto = formatearEfemeride(efem, `${hora}:00`)

      try {
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
        console.log(`[CRON] Efeméride enviada a ${grupoId} a las ${hora}:00`)
      } catch (e) { console.log("Error cron", e.message) }
    }
  }, { timezone: "America/Lima" })

  console.log("⏰ Cron ZYON-FVS™ activado: 6am-12am cada hora")
}

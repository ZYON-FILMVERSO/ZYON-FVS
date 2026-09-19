import { obtenerEfemerideUnica } from "../modules/efemerides.service.js"
import { formatearEfemeride } from "../modules/formatter.js"
import { getHistorial, addHistorial } from "../modules/history.manager.js"

export async function cmdEfemerides(sock, grupoId) {
  const historial = getHistorial(grupoId)
  const efem = await obtenerEfemerideUnica(historial)
  if (!efem) throw new Error("No se encontró efeméride")

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

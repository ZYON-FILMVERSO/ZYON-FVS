export function getHoraPeru() {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Lima" })
  const d = new Date(now)
  return {
    hora: d.getHours(),
    minuto: d.getMinutes(),
    horaFormateada: d.toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit', timeZone: "America/Lima" }),
    fecha: d.toLocaleDateString("es-PE", { timeZone: "America/Lima" })
  }
}
export function esHorarioPermitido() {
  const { hora } = getHoraPeru()
  return hora >= 6 && hora < 24
}

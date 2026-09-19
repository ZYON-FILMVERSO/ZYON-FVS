import fs from "fs"
const HISTORIAL_PATH = "./src/database/historial.json"
const GRUPOS_PATH = "./src/database/grupos.json"

function leer(ruta) {
  if (!fs.existsSync(ruta)) { fs.writeFileSync(ruta, "{}"); return {} }
  return JSON.parse(fs.readFileSync(ruta))
}
function guardar(ruta, data) { fs.writeFileSync(ruta, JSON.stringify(data, null, 2)) }

export function getHistorial(grupoId) {
  const db = leer(HISTORIAL_PATH)
  return db[grupoId] || []
}
export function addHistorial(grupoId, idEfemeride) {
  const db = leer(HISTORIAL_PATH)
  if (!db[grupoId]) db[grupoId] = []
  db[grupoId].push(idEfemeride)
  if (db[grupoId].length > 20000) db[grupoId] = [] // resetea ciclo
  guardar(HISTORIAL_PATH, db)
}
export function getGrupos() { return leer(GRUPOS_PATH) }
export function setGrupoActivo(grupoId, activo) {
  const db = leer(GRUPOS_PATH)
  db[grupoId] = { activo, updated: new Date().toISOString() }
  guardar(GRUPOS_PATH, db)
}

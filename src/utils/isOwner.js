import fs from "fs"
const PATH = "./src/database/owners.json"

export function getOwners() {
  if (!fs.existsSync(PATH)) return { owners: [], botNumber: "" }
  return JSON.parse(fs.readFileSync(PATH))
}

export function isOwner(numero) {
  const { owners, botNumber } = getOwners()
  const clean = numero.replace(/[^0-9]/g, "")
  // el numero viene como 519...@s.whatsapp.net
  return owners.some(o => clean.includes(o)) || clean.includes(botNumber)
}

export function addOwnerDb(numero) {
  const data = getOwners()
  const clean = numero.replace(/[^0-9]/g, "")
  if (!data.owners.includes(clean)) {
    data.owners.push(clean)
    fs.writeFileSync(PATH, JSON.stringify(data, null, 2))
    return true
  }
  return false
}

export function delOwnerDb(numero) {
  const data = getOwners()
  const clean = numero.replace(/[^0-9]/g, "")
  const antes = data.owners.length
  data.owners = data.owners.filter(o => o!== clean)
  fs.writeFileSync(PATH, JSON.stringify(data, null, 2))
  return data.owners.length < antes
}

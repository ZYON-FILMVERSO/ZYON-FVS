import fs from "fs"
import config from "../core/config.js"
export async function cmdHelp(sock, grupoId) {
  const menuPath = "./src/assets/menu.jpg"
  const logoPath = "./src/assets/logo.jpg"
  const imgPath = fs.existsSync(menuPath)? menuPath : (fs.existsSync(logoPath)? logoPath : null)

  const texto = `╭─ ${config.BOT_NAME} ─╮\n📜 MENU\n\n• hoy / dia / efemerides\n• efemerides on/off (admin)\n• setimg (reply img) - solo owner\n• addowner 519... - solo owner\n• listowner\n╰─ ${config.BOT_NAME} ─╯`

  if (imgPath) {
    await sock.sendMessage(grupoId, { image: { url: imgPath }, caption: texto })
  } else {
    await sock.sendMessage(grupoId, { text: texto })
  }
}

import config from "../core/config.js"

export function formatearEfemeride(e, hora = null) {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
  const fechaBonita = `${e.dia} de ${meses[parseInt(e.mes)-1]}`

  return `
╭─━━━━━━━━━━━━━━─╮
   📜 *E F E M É R I D E S* 📜
   ${hora? `⏰ ${hora} | ${fechaBonita}` : `📅 ${fechaBonita}`}
╰─━━━━━━━━━━━━━━─╯

✦ ˚ ༘ *AÑO:* ${e.year}
✦ ˚ ༘ *SUCESO:* ${e.titulo.replace(/_/g," ")}

━━━━━━━━━━━━━━━━━━━━━━
❖ *¿QUÉ PASÓ?*
${e.text}

━━━━━━━━━━━━━━━━━━━━━━
📖 *HISTORIA COMPLETA:*
${e.extract}

━━━━━━━━━━━━━━━━━━━━━━
🔗 https://es.wikipedia.org/wiki/${encodeURIComponent(e.titulo)}

╰─━━━━━━━━━━━━━━─╯
⚡ _Efeméride única, no se repetirá_
🤖 *${config.BOT_NAME}* 🤖
╰─━━━━━━━━━━━━━━─╯
`.trim()
}

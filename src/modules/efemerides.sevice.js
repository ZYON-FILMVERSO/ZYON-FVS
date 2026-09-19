import axios from "axios"

export async function obtenerEfemerideUnica(historialGrupo = []) {
  let intentos = 0
  while (intentos < 20) {
    const mes = String(Math.floor(Math.random()*12)+1).padStart(2,'0')
    const dia = String(Math.floor(Math.random()*28)+1).padStart(2,'0')
    const tipo = ["events","births","deaths"][Math.floor(Math.random()*3)]

    const url = `https://es.wikipedia.org/api/rest_v1/feed/onthisday/${tipo}/${mes}/${dia}`
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'ZYON-FVS/1.0' } })

    const lista = data[tipo] || data.events
    const evento = lista[Math.floor(Math.random()*lista.length)]
    const idUnico = `${evento.year}-${evento.text.substring(0,50)}`

    if (historialGrupo.includes(idUnico)) { intentos++; continue; }

    const pagina = evento.pages?.[0]
    if (!pagina) continue

    // Detecta si es video o imagen
    let mediaUrl = pagina.originalimage?.source || pagina.thumbnail?.source || null
    let isVideo = false
    if (mediaUrl && (mediaUrl.endsWith(".mp4") || mediaUrl.endsWith(".webm") || mediaUrl.endsWith(".ogv"))) {
      isVideo = true
    }

    // Si la pagina tiene video, intenta buscarlo mejor
    if (!isVideo) {
      try {
        const title = pagina.titles.normalized
        const mediaApi = `https://es.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images&imlimit=20&format=json&origin=*`
        const res = await axios.get(mediaApi)
      } catch {}
    }

    return {
      id: idUnico,
      year: evento.year,
      text: evento.text,
      extract: pagina.extract,
      titulo: pagina.titles.normalized,
      mediaUrl,
      isVideo,
      mes, dia
    }
  }
  return null
}

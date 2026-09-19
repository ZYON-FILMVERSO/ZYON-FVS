import pkg from "@whiskeysockets/baileys"
const makeWASocket = pkg.default || pkg.makeWASocket
const useMultiFileAuthState = pkg.useMultiFileAuthState
const DisconnectReason = pkg.DisconnectReason
const fetchLatestBaileysVersion = pkg.fetchLatestBaileysVersion
import pino from "pino"
import fs from "fs"
import express from "express"
import QRCode from "qrcode"
import { OWNER, PREFIX, BOT_NAME } from "./config.js"

const app = express()
const PORT = process.env.PORT || 10000
let lastQR = null
let lastCode = null
let estado = "Iniciando..."

app.get("/", async (req, res) => {
  let qrImg = ""
  if (lastQR) qrImg = await QRCode.toDataURL(lastQR)
  res.send(`<html><head><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="2"><style>body{background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:15px}.box{background:#222;padding:20px;border-radius:20px;max-width:380px;margin:auto}code{font-size:32px;background:#000;color:#25D366;padding:15px;border-radius:10px;display:block;letter-spacing:5px;font-weight:bold}img{background:#fff;padding:10px;border-radius:10px;margin-top:10px}</style></head><body><div class="box"><h2>${BOT_NAME}</h2><p>${estado}</p>${lastCode ? `<code>${lastCode}</code><p>Ve a WhatsApp > Vincular con numero</p>` : `<p>Generando codigo, espera 5 seg...</p>`}${qrImg ? `<img src="${qrImg}" width="260"/>` : ``}<br><br><a href="/reset" style="color:red">Borrar sesion</a></div></body></html>`)
})
app.get("/reset", (req,res)=>{ try{fs.rmSync("./session",{recursive:true,force:true})}catch{}; lastQR=null; lastCode=null; res.send("Borrado, reinicia npm start"); })
app.listen(PORT, ()=>console.log(`[SERVER] Escuchando en el puerto ${PORT}`))

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState("./session")
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, auth: state, logger: pino({level:"silent"}), browser:[BOT_NAME,"Chrome","1.0"], printQRInTerminal:false })
  
  if(!state.creds.registered){
    estado="No hay sesion, generando codigo..."
    setTimeout(async()=>{
      try{
        const num = OWNER[0].split("@")[0]
        console.log("Pidiendo codigo para", num)
        const code = await sock.requestPairingCode(num)
        lastCode=code; estado=`Codigo para ${num}`; console.log("CODIGO:",code)
      }catch(e){ estado="Error: "+e.message; console.log(e) }
    },3000)
  }

  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", (u)=>{
    const {connection,qr,lastDisconnect}=u
    if(qr){ lastQR=qr; estado="Escanea QR o usa codigo"; console.log("QR generado") }
    if(connection==="open"){ estado="✅ CONECTADO"; console.log("CONECTADO") }
    if(connection==="close"){ const rec = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut; if(rec) setTimeout(startBot,3000) }
  })
}
startBot()

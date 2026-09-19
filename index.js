import pkg from "@whiskeysockets/baileys"
const makeWASocket = pkg.default || pkg.makeWASocket
const useMultiFileAuthState = pkg.useMultiFileAuthState
const DisconnectReason = pkg.DisconnectReason
const fetchLatestBaileysVersion = pkg.fetchLatestBaileysVersion
import pino from "pino"
import fs from "fs"
import axios from "axios"
import moment from "moment-timezone"
import { OWNER, PREFIX, BOT_NAME, TIMEZONE } from "./config.js"

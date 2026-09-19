export const logger = {
  info: (m) => console.log(`\x1b[36m[ZYON-FVS™]\x1b[0m ${m}`),
  success: (m) => console.log(`\x1b[32m[OK]\x1b[0m ${m}`),
  error: (m) => console.log(`\x1b[31m[ERROR]\x1b[0m ${m}`),
  cron: (m) => console.log(`\x1b[33m[CRON]\x1b[0m ${m}`)
}

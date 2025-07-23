import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

const app = new Hono()

const TELEGRAM_TOKEN = "你的TelegramToken"
const PROJECT_ID = "你的Tiledesk Project ID"
const SECRET = "你的Tiledesk Secret"
const TILE_DESK_API = "https://api.tiledesk.com/v2"
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

// Telegram Webhook
app.post('/telegram', async (c) => {
  const body = await c.req.json()
  console.log("Telegram Body:", body)

  const text = body.message?.text || ''
  const chat_id = body.message?.chat.id
  const from = body.message?.from.id
  const firstname = body.message?.from.first_name || ''
  const lastname = body.message?.from.last_name || ''

  const msg = {
    text,
    senderFullname: `${firstname} ${lastname}`,
    channel: { name: "telegram" }
  }

  const payload = {
    _id: `telegram-${from}`,
    first_name: firstname,
    last_name: lastname,
    fullname: `${firstname} ${lastname}`,
    email: "na@telegram.com",
    sub: "userexternal",
    aud: `https://tiledesk.com/projects/${PROJECT_ID}`
  }

  const custom_token = jwt.sign(payload, SECRET)

  // 登录 Tiledesk
  const signIn = await fetch(`${TILE_DESK_API}/auth/signinWithCustomToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `JWT ${custom_token}`
    }
  })
  const signInRes = await signIn.json()
  const token = signInRes.token

  // 查询是否已有会话
  const checkReq = await fetch(`${TILE_DESK_API}/${PROJECT_ID}/requests/me?channel=telegram`, {
    headers: { 'Authorization': token }
  })
  const checkRes = await checkReq.json()

  const request_id = checkRes.requests?.[0]?.request_id ||
    `support-group-${PROJECT_ID}-${uuidv4()}-telegram-${from}`

  // 发送消息到 Tiledesk
  await fetch(`${TILE_DESK_API}/${PROJECT_ID}/requests/${request_id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(msg)
  })

  return c.json({ ok: true })
})

// Tiledesk 回传到 Telegram
app.post('/tiledesk', async (c) => {
  const body = await c.req.json()
  const payload = body.payload
  const sender_id = payload.sender

  if (sender_id.includes("telegram")) return c.text("Skip")

  const chat_id = payload.recipient.split("-").pop()

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text: payload.text })
  })

  return c.text("Message Sent")
})

export default app

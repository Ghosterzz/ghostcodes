import 'dotenv/config'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import legacyProjects from '../data/projects.json' with { type: 'json' }

const SESSION_MS = 24 * 60 * 60 * 1000
const STATE_MS = 10 * 60 * 1000
let connectionPromise

const userSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, maxlength: 100 },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['visitor', 'member'], default: 'visitor' },
  lastLoginAt: { type: Date, default: Date.now }
}, { timestamps: true })
const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'GhostUser', required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true })
const stateSchema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  returnTo: { type: String, enum: ['/', '/admin'], default: '/' },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true })
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  url: { type: String, required: true, maxlength: 2048 },
  image: { type: String, default: '', maxlength: 2048 },
  tags: { type: [String], default: [], validate: value => value.length <= 5 },
  featured: { type: Boolean, default: false },
  memberOnly: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true })
const bugReportSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  details: { type: String, required: true, maxlength: 2000 },
  pageUrl: { type: String, required: true, maxlength: 2048 },
  reporter: { type: String, default: '', maxlength: 80 },
  ipHash: { type: String, required: true, index: true },
  discordMessageId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true })

const User = mongoose.models.GhostUser || mongoose.model('GhostUser', userSchema)
const Session = mongoose.models.GhostSession || mongoose.model('GhostSession', sessionSchema)
const OAuthState = mongoose.models.GhostOAuthState || mongoose.model('GhostOAuthState', stateSchema)
const Project = mongoose.models.GhostProject || mongoose.model('GhostProject', projectSchema)
const BugReport = mongoose.models.GhostBugReport || mongoose.model('GhostBugReport', bugReportSchema)

const starterProjects = legacyProjects.map(project => ({
  title: project.title,
  description: project.description,
  url: project.url,
  image: project.image || '',
  tags: Array.isArray(project.tags) ? project.tags : [],
  featured: Boolean(project.featured),
  memberOnly: Boolean(project.memberOnly),
  createdAt: project.createdAt || new Date()
}))

async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.')
  if (mongoose.connection.readyState === 1) return
  if (connectionPromise) {
    await connectionPromise
    if (mongoose.connection.readyState === 1) return
    connectionPromise = undefined
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 5,
      bufferCommands: false
    }).then(async () => {
      await Promise.all(starterProjects.map(project => {
        const seedId = new mongoose.Types.ObjectId(hash(project.url).slice(0, 24))
        return Project.updateOne({ _id: seedId }, { $setOnInsert: project }, { upsert: true })
      }))
    }).catch(error => {
      connectionPromise = undefined
      throw error
    })
  }
  await connectionPromise
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function allowedAdminIds() {
  return (process.env.DISCORD_ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
}

function isAdmin(user) {
  return allowedAdminIds().includes(user.discordId)
}

function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

function getCookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      try { return decodeURIComponent(rest.join('=')) } catch { return null }
    }
  }
  return null
}

function cookie(name, value, { maxAge, path = '/', secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

function expiredCookie(name, path = '/') {
  const secure = process.env.NODE_ENV === 'production' && process.env.NETLIFY_DEV !== 'true'
  return `${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}

function secureCookies() {
  return process.env.NODE_ENV === 'production' && process.env.NETLIFY_DEV !== 'true'
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  })
}

function redirect(location, headers = {}) {
  const responseHeaders = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'set-cookie' && Array.isArray(value)) value.forEach(cookieValue => responseHeaders.append('Set-Cookie', cookieValue))
    else responseHeaders.set(name, value)
  }
  return new Response(null, { status: 302, headers: responseHeaders })
}

async function bodyJson(request) {
  try { return await request.json() } catch { return null }
}

async function currentUser(request) {
  const token = getCookie(request, 'ghostcodes_session')
  if (!token) return null
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).populate('userId')
  return session?.userId || null
}

function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

function oauthConfigured() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI)
}

async function guildRole(accessToken) {
  const guildId = process.env.DISCORD_GUILD_ID
  if (!guildId) return 'member'
  const response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${encodeURIComponent(guildId)}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000)
  })
  if (response.status === 404) return 'visitor'
  if (!response.ok) throw new Error(`Discord server membership check failed (${response.status})`)
  const member = await response.json()
  const allowedRoleId = process.env.DISCORD_MEMBER_ROLE_ID
  if (allowedRoleId && !(member.roles || []).includes(allowedRoleId)) return 'visitor'
  return 'member'
}

async function handleDiscordCallback(request, url) {
  const state = url.searchParams.get('state') || ''
  const stateCookie = getCookie(request, 'ghostcodes_oauth_state')
  const expiredState = expiredCookie('ghostcodes_oauth_state', '/auth/callback')
  if (!oauthConfigured() || !url.searchParams.get('code') || !state || !stateCookie || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie))) {
    return redirect('/admin?error=discord-signin', { 'Set-Cookie': expiredState })
  }

  const savedState = await OAuthState.findOneAndDelete({ stateHash: hash(state), expiresAt: { $gt: new Date() } })
  if (!savedState) return redirect('/admin?error=discord-signin', { 'Set-Cookie': expiredState })

  const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: url.searchParams.get('code'),
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    }),
    signal: AbortSignal.timeout(10000)
  })
  if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`)
  const tokenData = await tokenResponse.json()
  const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10000)
  })
  if (!userResponse.ok) throw new Error(`Discord identity lookup failed (${userResponse.status})`)
  const discordUser = await userResponse.json()
  const role = await guildRole(tokenData.access_token)
  const admins = allowedAdminIds()
  if (admins.length && !admins.includes(discordUser.id) && role !== 'member') {
    const error = savedState.returnTo === '/admin' ? 'not-authorized' : 'server-members-only'
    return redirect(`${savedState.returnTo}?error=${error}`, { 'Set-Cookie': expiredState })
  }

  const user = await User.findOneAndUpdate({ discordId: discordUser.id }, {
    $set: {
      username: discordUser.global_name || discordUser.username,
      avatar: discordUser.avatar || null,
      role,
      lastLoginAt: new Date()
    }
  }, { upsert: true, new: true, runValidators: true })
  const token = crypto.randomBytes(32).toString('base64url')
  await Session.create({ tokenHash: hash(token), userId: user._id, expiresAt: new Date(Date.now() + SESSION_MS) })
  return redirect(`${savedState.returnTo}?login=success`, {
    'Set-Cookie': [
      cookie('ghostcodes_session', token, { maxAge: SESSION_MS / 1000, secure: secureCookies() }),
      expiredState
    ]
  })
}

async function notifyDiscord(report) {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_BUG_CHANNEL_ID) return null
  const response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(process.env.DISCORD_BUG_CHANNEL_ID)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `Website bug: ${report.title}`,
        description: report.details,
        color: 14934763,
        fields: [
          { name: 'Page', value: report.pageUrl.slice(0, 1024) },
          { name: 'Reported by', value: report.reporter || 'Anonymous' }
        ],
        timestamp: report.createdAt.toISOString()
      }]
    }),
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) throw new Error(`Discord bug notification failed (${response.status})`)
  return response.json()
}

async function handleApi(request, path) {
  if (path === '/api/session' && request.method === 'GET') {
    const user = await currentUser(request)
    if (!user) return json({ authenticated: false, role: 'visitor' })
    return json({ authenticated: true, role: isAdmin(user) ? 'admin' : user.role, username: user.username, avatar: user.avatar })
  }

  if (path === '/api/projects' && request.method === 'GET') {
    const user = await currentUser(request)
    const member = Boolean(user && (user.role === 'member' || isAdmin(user)))
    const query = member ? {} : { memberOnly: false }
    const projects = await Project.find(query).sort({ featured: -1, title: 1 }).lean()
    return json(projects.map(({ _id, __v, ...project }) => ({ ...project, id: String(_id) })))
  }

  if (path === '/api/logout' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'Request origin was rejected.' }, 403)
    const token = getCookie(request, 'ghostcodes_session')
    if (token) await Session.deleteOne({ tokenHash: hash(token) })
    return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie('ghostcodes_session') })
  }

  if (path === '/api/projects' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'Request origin was rejected.' }, 403)
    const user = await currentUser(request)
    if (!user || !isAdmin(user)) return json({ error: 'Admin access is required.' }, 401)
    const data = await bodyJson(request)
    const title = String(data?.title || '').trim()
    const description = String(data?.description || '').trim()
    const projectUrl = safeUrl(String(data?.url || '').trim())
    const imageUrl = data?.image ? safeUrl(String(data.image).trim()) : ''
    if (!title || !description || !projectUrl) return json({ error: 'Add a title, description, and valid project URL.' }, 400)
    if (data.image && !imageUrl) return json({ error: 'The image must use a valid http or https URL.' }, 400)
    const project = await Project.create({
      title: title.slice(0, 80),
      description: description.slice(0, 300),
      url: projectUrl,
      image: imageUrl,
      tags: Array.isArray(data.tags) ? data.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 5) : [],
      featured: Boolean(data.featured),
      memberOnly: Boolean(data.memberOnly)
    })
    return json({ id: String(project._id), title: project.title }, 201)
  }

  const projectDelete = path.match(/^\/api\/projects\/([a-f\d]{24})$/i)
  if (projectDelete && request.method === 'DELETE') {
    if (!sameOrigin(request)) return json({ error: 'Request origin was rejected.' }, 403)
    const user = await currentUser(request)
    if (!user || !isAdmin(user)) return json({ error: 'Admin access is required.' }, 401)
    const deleted = await Project.findByIdAndDelete(projectDelete[1])
    return deleted ? new Response(null, { status: 204 }) : json({ error: 'Project not found.' }, 404)
  }

  if (path === '/api/bug-reports' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'Request origin was rejected.' }, 403)
    const user = await currentUser(request)
    if (!user) return json({ error: 'Sign in with Discord before sending a report.' }, 401)
    const data = await bodyJson(request)
    if (data?.website) return json({ ok: true }, 201)
    const title = String(data?.title || '').trim().slice(0, 120)
    const details = String(data?.details || '').trim().slice(0, 2000)
    const pageUrl = safeUrl(String(data?.pageUrl || '').trim())
    if (!title || details.length < 10 || !pageUrl) return json({ error: 'Add a short title, at least 10 characters of detail, and a valid page URL.' }, 400)
    const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ipHashSecret = process.env.IP_HASH_SECRET || process.env.DISCORD_CLIENT_SECRET || process.env.MONGODB_URI
    const ipHash = crypto.createHmac('sha256', ipHashSecret || 'unconfigured').update(ip).digest('hex')
    const recentCount = await BugReport.countDocuments({ ipHash, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } })
    if (recentCount >= 3) return json({ error: 'Too many reports from this connection. Please try again later.' }, 429)
    const report = await BugReport.create({ title, details, pageUrl, reporter: user.username, ipHash })
    let notified = false
    try {
      const message = await notifyDiscord(report)
      if (message?.id) {
        report.discordMessageId = message.id
        await report.save()
        notified = true
      }
    } catch (error) {
      console.error('Bug report saved but Discord notification failed:', error.message)
    }
    return json({ ok: true, notified }, 201)
  }

  return json({ error: 'Not found.' }, 404)
}

export default async function handler(request) {
  const url = new URL(request.url)
  const functionPrefix = '/.netlify/functions/api'
  let path = url.pathname.startsWith(functionPrefix) ? url.pathname.slice(functionPrefix.length) || '/' : url.pathname

  try {
    if (path === '/auth/discord' && request.method === 'GET') {
      const requestedReturn = url.searchParams.get('next')
      const returnTo = requestedReturn === '/admin' ? '/admin' : '/'
      if (!oauthConfigured()) return redirect(`${returnTo}?error=setup`)
      await connectDatabase()
      const state = crypto.randomBytes(32).toString('base64url')
      await OAuthState.create({ stateHash: hash(state), returnTo, expiresAt: new Date(Date.now() + STATE_MS) })
      const authorization = new URL('https://discord.com/oauth2/authorize')
      authorization.search = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        response_type: 'code',
        scope: process.env.DISCORD_GUILD_ID ? 'identify guilds.members.read' : 'identify',
        state,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        prompt: 'consent'
      }).toString()
      return redirect(authorization.toString(), {
        'Set-Cookie': cookie('ghostcodes_oauth_state', state, { maxAge: STATE_MS / 1000, path: '/auth/callback', secure: secureCookies() })
      })
    }

    if (path === '/auth/callback' && request.method === 'GET') {
      await connectDatabase()
      return await handleDiscordCallback(request, url)
    }

    if (path.startsWith('/api/')) {
      await connectDatabase()
      return await handleApi(request, path)
    }

    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    console.error('API request failed:', error.message)
    if (path === '/auth/callback') return redirect('/admin?error=discord-signin', { 'Set-Cookie': expiredCookie('ghostcodes_oauth_state', '/auth/callback') })
    if (path.startsWith('/auth/')) return redirect('/admin?error=discord-signin')
    return json({ error: 'The service could not complete that request. Please try again.' }, 500)
  }
}

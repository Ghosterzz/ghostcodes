import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { commands } from './commands.mjs'

const { DISCORD_BOT_TOKEN: token, DISCORD_CLIENT_ID: clientId } = process.env
const guildId = process.env.DISCORD_COMMAND_GUILD_ID || process.env.DISCORD_GUILD_ID
if (!token || !clientId) {
  console.error('Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in .env before deploying commands.')
  process.exit(1)
}

const rest = new REST({ version: '10' }).setToken(token)
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId)

try {
  const deployed = await rest.put(route, { body: commands })
  console.log(`Registered ${deployed.length} slash commands ${guildId ? `to server ${guildId}` : 'globally'}.`)
} catch (error) {
  console.error('Could not register Discord commands:', error.message)
  process.exitCode = 1
}

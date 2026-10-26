import 'dotenv/config'
import {
  ActivityType,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('Set DISCORD_BOT_TOKEN in .env before starting the bot.')
  process.exit(1)
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const websiteUrl = (process.env.WEBSITE_URL || '').replace(/\/$/, '')
const bugChannelId = process.env.DISCORD_BUG_CHANNEL_ID
const colours = { primary: 0x6c63ff, success: 0x43b581, error: 0xed4245 }

function errorReply(interaction, message) {
  const payload = { content: message, ephemeral: true }
  return interaction.replied || interaction.deferred
    ? interaction.followUp(payload)
    : interaction.reply(payload)
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Online as ${readyClient.user.tag}`)
  readyClient.user.setPresence({
    activities: [{ name: '/help · GhostCodes', type: ActivityType.Watching }],
    status: 'online'
  })
})

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) await handleCommand(interaction)
    else if (interaction.isModalSubmit() && interaction.customId === 'ghostcodes:bug') await handleBugSubmit(interaction)
  } catch (error) {
    console.error(`Interaction ${interaction.commandName || interaction.customId || 'unknown'} failed:`, error.message)
    await errorReply(interaction, 'That command failed. Please try again in a moment.')
  }
})

async function handleCommand(interaction) {
  switch (interaction.commandName) {
    case 'help': {
      const embed = new EmbedBuilder()
        .setColor(colours.primary)
        .setTitle('GhostCodes bot commands')
        .setDescription([
          '`/ping` — check bot latency',
          '`/projects` — browse the public portfolio projects',
          '`/bug` — send a report to the website team',
          '`/serverinfo` — view server details',
          '`/userinfo [user]` — view member details',
          '`/clear amount` — remove recent messages (Manage Messages)',
          '`/timeout user minutes [reason]` — timeout a member (Moderate Members)'
        ].join('\n'))
        .setFooter({ text: 'GhostCodes · moderation commands require server permissions' })
      return interaction.reply({ embeds: [embed], ephemeral: true })
    }
    case 'ping': {
      const latency = Math.max(0, Date.now() - interaction.createdTimestamp)
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(colours.success).setDescription(`Pong! Gateway: ${Math.round(interaction.client.ws.ping)} ms · Response: ${latency} ms`)] })
    }
    case 'projects': return showProjects(interaction)
    case 'bug': {
      const modal = new ModalBuilder().setCustomId('ghostcodes:bug').setTitle('Report a website bug')
        .addComponents(
          { type: 1, components: [new TextInputBuilder().setCustomId('title').setLabel('Short title').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)] },
          { type: 1, components: [new TextInputBuilder().setCustomId('details').setLabel('What happened?').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)] },
          { type: 1, components: [new TextInputBuilder().setCustomId('page').setLabel('Page URL (optional)').setStyle(TextInputStyle.Short).setMaxLength(500).setRequired(false)] }
        )
      return interaction.showModal(modal)
    }
    case 'serverinfo': {
      const guild = interaction.guild
      if (!guild) return errorReply(interaction, 'Use this command inside a server.')
      const owner = await guild.fetchOwner()
      const embed = new EmbedBuilder().setColor(colours.primary).setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: 'Owner', value: owner.user.tag, inline: true },
          { name: 'Members', value: String(guild.memberCount), inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Channels', value: String(guild.channels.cache.size), inline: true },
          { name: 'Roles', value: String(guild.roles.cache.size), inline: true }
        )
      return interaction.reply({ embeds: [embed] })
    }
    case 'userinfo': {
      const user = interaction.options.getUser('user') || interaction.user
      const member = await interaction.guild?.members.fetch(user.id).catch(() => null)
      const embed = new EmbedBuilder().setColor(colours.primary).setTitle(user.globalName || user.username)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Account created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Joined server', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Not in this server', inline: true },
          { name: 'Roles', value: member ? (member.roles.cache.filter(role => role.id !== interaction.guildId).map(role => role.name).slice(0, 10).join(', ') || 'None') : '—' }
        )
      return interaction.reply({ embeds: [embed] })
    }
    case 'clear': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return errorReply(interaction, 'You need Manage Messages to use this command.')
      if (!interaction.channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(interaction.channel.type)) return errorReply(interaction, 'Use this command in a text channel.')
      const amount = interaction.options.getInteger('amount', true)
      const deleted = await interaction.channel.bulkDelete(amount, true)
      return interaction.reply({ content: `Deleted ${deleted.size} recent message${deleted.size === 1 ? '' : 's'}. Messages older than 14 days are skipped by Discord.`, ephemeral: true })
    }
    case 'timeout': {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) return errorReply(interaction, 'You need Moderate Members to use this command.')
      const user = interaction.options.getUser('user', true)
      const minutes = interaction.options.getInteger('minutes', true)
      const reason = interaction.options.getString('reason') || `Requested by ${interaction.user.tag}`
      if (user.id === interaction.user.id) return errorReply(interaction, 'You cannot timeout yourself.')
      if (user.id === interaction.guild?.ownerId) return errorReply(interaction, 'The server owner cannot be timed out.')
      const member = await interaction.guild?.members.fetch(user.id).catch(() => null)
      if (!member) return errorReply(interaction, 'That user is not a member of this server.')
      if (!member.moderatable) return errorReply(interaction, 'I cannot timeout that member. Check my role position and permissions.')
      await member.timeout(minutes * 60_000, reason.slice(0, 512))
      const embed = new EmbedBuilder().setColor(colours.success).setDescription(`Timed out ${user.tag} for ${minutes} minute${minutes === 1 ? '' : 's'}.`).addFields({ name: 'Reason', value: reason.slice(0, 1000) })
      return interaction.reply({ embeds: [embed] })
    }
    default: return errorReply(interaction, 'I do not recognize that command. Try `/help`.')
  }
}

async function showProjects(interaction) {
  if (!websiteUrl) return errorReply(interaction, 'The website URL is not configured for this bot.')
  await interaction.deferReply()
  const response = await fetch(`${websiteUrl}/api/projects`, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`Project endpoint returned ${response.status}`)
  const projects = await response.json()
  const embed = new EmbedBuilder().setColor(colours.primary).setTitle('GhostCodes projects').setURL(websiteUrl)
    .setDescription(projects.length
      ? projects.slice(0, 8).map(project => `**[${String(project.title).slice(0, 100)}](${project.url})**\n${String(project.description).slice(0, 180)}`).join('\n\n')
      : 'No public projects have been published yet.')
    .setFooter({ text: projects.length > 8 ? `Showing 8 of ${projects.length} projects` : `${projects.length} project${projects.length === 1 ? '' : 's'}` })
  return interaction.editReply({ embeds: [embed] })
}

async function handleBugSubmit(interaction) {
  if (!bugChannelId) return errorReply(interaction, 'Bug reports are not configured yet. Ask a server administrator to set DISCORD_BUG_CHANNEL_ID.')
  const channel = await interaction.client.channels.fetch(bugChannelId)
  if (!channel?.isTextBased() || !channel.send) throw new Error('Bug report channel is unavailable or not text-based')
  const title = interaction.fields.getTextInputValue('title').trim()
  const details = interaction.fields.getTextInputValue('details').trim()
  const page = interaction.fields.getTextInputValue('page').trim()
  const embed = new EmbedBuilder().setColor(colours.primary).setTitle(title.slice(0, 256))
    .setDescription(details.slice(0, 4000))
    .addFields(
      { name: 'Reported by', value: `${interaction.user.tag} (${interaction.user.id})` },
      ...(page ? [{ name: 'Page', value: page.slice(0, 1024) }] : [])
    )
    .setTimestamp()
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })
  return interaction.reply({ content: 'Your report has been sent to the GhostCodes team. Thank you!', ephemeral: true })
}

client.on(Events.Error, error => console.error('Discord client error:', error.message))
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error instanceof Error ? error.message : error))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`Received ${signal}; shutting down Discord connection.`)
    client.destroy()
    process.exit(0)
  })
}

client.login(token).catch(error => {
  console.error('Could not log in to Discord. Check the bot token and application settings:', error.message)
  process.exit(1)
})

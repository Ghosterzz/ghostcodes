import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js'

export const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show GhostCodes bot commands'),
  new SlashCommandBuilder().setName('ping').setDescription('Check the bot and Discord API latency'),
  new SlashCommandBuilder().setName('projects').setDescription('Show projects published on the GhostCodes website'),
  new SlashCommandBuilder().setName('bug').setDescription('Send a bug report to the website team'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Show information about this server'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a server member')
    .addUserOption(option => option.setName('user').setDescription('Member to inspect').setRequired(false)),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to remove (1–100)').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member for a number of minutes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes (1–40320)').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the timeout').setMaxLength(400).setRequired(false))
].map(command => command.toJSON())

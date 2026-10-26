# GhostCodes

The original website remains in `public/` and is started with `npm start`.

## Discord bot

The standalone bot process is in `bot/`. It connects to Discord so it stays online and provides these slash commands:

- `/help`, `/ping`
- `/projects` — lists public projects from the website API
- `/bug` — opens a form and sends the report to the configured channel
- `/serverinfo`, `/userinfo`
- `/clear` — requires Manage Messages
- `/timeout` — requires Moderate Members

Copy `bot/.env.example` to `bot/.env`, then set the bot token, application ID, bug-report channel ID, and server ID. `WEBSITE_URL` enables `/projects`. Never commit `.env` or share the bot token.

Install dependencies, register commands, and run the bot from the repository root:

```sh
npm --prefix bot install
npm --prefix bot run commands
npm --prefix bot start
```

`DISCORD_COMMAND_GUILD_ID` can target a development server for quick command updates; otherwise `DISCORD_GUILD_ID` is used, and if neither is set commands are registered globally. Global command changes can take longer to appear.

The bot must run as a persistent Node.js process on an always-on host to stay online. Netlify Functions and the website server are not used as the bot's Gateway process.

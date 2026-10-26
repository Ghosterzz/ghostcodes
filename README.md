# GhostCodes portfolio

The site is hosted on Netlify. Static pages live in `dist/`; the API and Discord OAuth callback run as Netlify Functions. Mongoose stores Discord users, sessions, projects, and bug reports in MongoDB Atlas.

## Set up local development

```powershell
npm install
Copy-Item .env.example .env
```

Fill in `.env`, then run:

```powershell
npm start
```

Netlify Dev serves the site at `http://localhost:8888`. Add `http://localhost:8888/auth/callback` to the Discord application's OAuth2 redirect URLs.

## Required configuration

Create a MongoDB Atlas database and a database user scoped to the `ghostcodes` database. Add the Atlas connection string as `MONGODB_URI`. Set the values from `.env.example` in Netlify's environment variables for production; never commit `.env` or place secrets in browser code.

Create a Discord application in the Discord Developer Portal. Set its OAuth2 redirect URL to `https://YOUR-SITE-DOMAIN/auth/callback`, and copy its client ID and secret into `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. Set `DISCORD_REDIRECT_URI` to that exact URL. Put your Discord user ID in `DISCORD_ADMIN_USER_IDS` to grant project-management access. Multiple admin IDs can be comma-separated.

Visitors can sign in with Discord. Signed-in community members can see projects marked **Members only** and submit bug reports. To restrict that access to your Discord server, set `DISCORD_GUILD_ID`; Discord sign-in will then request the `guilds.members.read` scope and check server membership. To require a particular role too, set `DISCORD_MEMBER_ROLE_ID`. Set your own ID in `DISCORD_ADMIN_USER_IDS` so you retain admin access.

## Discord bug-report bot

Create a bot under the same Discord application and add it to your server. The website's serverless function can post bug reports through the Discord API, while the separate bot process below keeps the bot online and adds slash commands. Give the bot only the permissions it needs: **Send Messages**, **Embed Links**, and (if using moderation commands) **Moderate Members** and **Manage Messages**. Set its token as `DISCORD_BOT_TOKEN` and the bug channel ID as `DISCORD_BUG_CHANNEL_ID`. Reports submitted on the website are stored in MongoDB and forwarded to the channel when configured. Never expose the bot token in browser code or commit it.

### Run the persistent Discord bot

Use the same `.env` file, adding `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` (the application ID), and `DISCORD_BUG_CHANNEL_ID`. Set `WEBSITE_URL` to the deployed website. For quick command registration, set `DISCORD_COMMAND_GUILD_ID` to your server ID; leave it blank to publish global commands.

```powershell
npm run bot:commands
npm run bot
```

The bot process provides `/help`, `/ping`, `/projects`, `/bug`, `/serverinfo`, `/userinfo`, `/clear`, and `/timeout`. Keep `npm run bot` running on your computer for local use. To keep it online continuously, run it on an always-on Node.js host (for example a VPS or worker service); Netlify Functions cannot maintain a Discord Gateway connection. `DISCORD_BUG_CHANNEL_ID` must refer to a channel the bot can access. The bot only requests the `Guilds` Gateway intent and does not read message contents.

## Netlify

The repository `netlify.toml` configures `dist` as the publish folder, `functions` as the Netlify Functions directory, and routes `/api/*` and `/auth/*` through the API function. Add the environment variables under **Site configuration → Environment variables**, then deploy. `npm run deploy:build` runs a local Netlify build.

MongoDB Atlas network access must allow connections from the deployed functions. Prefer Netlify static egress or another narrow allowlist when available; avoid opening Atlas to every IP unless you understand and accept that exposure. Use a database user with access only to this app's database and rotate credentials if they are ever exposed.

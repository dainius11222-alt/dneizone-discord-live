# DNEIZONE Discord Live API

This service powers the real owner/supporter/online counters and the latest #news messages.

Environment variables:
- DISCORD_BOT_TOKEN (secret; never place it in SellAuth)
- DISCORD_GUILD_ID=1550135145867124837
- DISCORD_NEWS_CHANNEL_ID=1550135146722623605
- DISCORD_SUPPORTER_ROLE_ID (optional; preferred)
- DISCORD_SUPPORTER_ROLE_NAME=supporter (fallback auto-detection)
- SITE_ORIGIN=https://dneizones.com

The Discord bot must have View Channel + Read Message History and the Developer Portal must enable Server Members Intent, Presence Intent and Message Content Intent.

After deployment, set `discordPro.endpoint` in `layouts/master.njk` to the deployment base URL. No bot token goes into the theme.

# DNEIZONE Discord Live API V29

This version adds reliable Owner/Support role detection, names, presences, news, diagnostics and CORS.

Render environment variables:
- DISCORD_BOT_TOKEN
- DISCORD_GUILD_ID=1550135145867124837
- DISCORD_NEWS_CHANNEL_ID=1550135146722623605
- DISCORD_OWNER_ROLE_NAME=exact role name (optional; auto-detects owner/founder/inhaber/leitung)
- DISCORD_SUPPORTER_ROLE_NAME=exact role name (optional; auto-detects supporter/support/helper)
- alternatively DISCORD_OWNER_ROLE_ID and DISCORD_SUPPORTER_ROLE_ID for exact matching

After deploy, open `/api/discord` and verify `apiVersion: 29`, `owners`, `supporters`, and `latest`.

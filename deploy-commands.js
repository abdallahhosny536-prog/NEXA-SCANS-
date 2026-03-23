require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { buildCommands } = require('./src/definitions');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

async function main() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const body = buildCommands().map(c => c.toJSON());

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
    console.log(`Registered guild commands for ${GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
    console.log('Registered global commands');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

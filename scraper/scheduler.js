import 'dotenv/config';
import cron from 'node-cron';
import { scrapeRaiderIOApplicants } from './raiderio-scraper.js';
import { scrapeWoWGuilds } from './wow-guilds-scraper.js';
import { scrapeWarcraftBlogs } from './blogs-scraper.js';
import { scrapeGoogleSheets } from './google-sheets-scraper.js';
import { scrapeWarcraftLogsGuildTeams } from './warcraft-logs-guild-teams.js';

const CONFIG = {
  guildName: process.env.GUILD_NAME || 'YourGuild',
  realm: process.env.REALM || 'Area-52',
  region: process.env.REGION || 'us',
  scrapeInterval: process.env.SCRAPE_INTERVAL || '0 * * * *' // Every hour instead of every 6 hours
};

async function runAllScrapers() {
  console.log(`[${new Date().toISOString()}] Starting scheduled scrape...`);
  
  try {
    await Promise.all([
      scrapeRaiderIOApplicants(CONFIG.guildName, CONFIG.realm, CONFIG.region),
      scrapeWoWGuilds(CONFIG.realm, CONFIG.region),
      scrapeWarcraftBlogs(),
      scrapeWarcraftLogsGuildTeams().catch(err => console.error('Error scraping guild teams:', err.message))
    ]);
    
    // Sync Council members from Blizzard API (replaces Guilds of WoW scraper)
    try {
      const { getGuildCouncilMembers } = await import('./blizzard-api.js');
      const { writeFileSync, existsSync, mkdirSync } = await import('fs');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const DATA_DIR = join(__dirname, '..', 'data');
      
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      
      const councilMembers = await getGuildCouncilMembers('Eclipsed', 'Stormrage', 'us');
      const councilData = {
        council: councilMembers,
        lastUpdated: new Date().toISOString(),
        source: 'Blizzard API'
      };
      
      writeFileSync(join(DATA_DIR, 'council.json'), JSON.stringify(councilData, null, 2));
      console.log(`✅ Synced ${councilMembers.length} Council members from Blizzard API`);
    } catch (councilError) {
      console.error('Error syncing Council members:', councilError.message);
    }
    
    // Also sync community Team Leads
    try {
      const { getGuildTeamLeads } = await import('./blizzard-api.js');
      const { writeFileSync, existsSync, mkdirSync } = await import('fs');
      const { join, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const DATA_DIR = join(__dirname, '..', 'data');
      
      if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
      }
      
      const teamLeads = await getGuildTeamLeads('Eclipsed', 'Stormrage', 'us', 2);
      const data = {
        teamLeads: teamLeads,
        lastUpdated: new Date().toISOString(),
        source: 'Blizzard API'
      };
      
      writeFileSync(join(DATA_DIR, 'community.json'), JSON.stringify(data, null, 2));
      console.log(`✅ Synced ${teamLeads.length} Team Lead members for Community tab`);
    } catch (communityError) {
      console.error('Error syncing community Team Leads:', communityError.message);
    }
    
    console.log(`[${new Date().toISOString()}] Scrape completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during scrape:`, error.message);
  }
}

async function runGoogleSheetsSync() {
  console.log(`[${new Date().toISOString()}] Starting Google Sheets sync...`);
  
  try {
    await scrapeGoogleSheets();
    console.log(`[${new Date().toISOString()}] Google Sheets sync completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during Google Sheets sync:`, error.message);
  }
}

console.log('Scheduler initialized');
console.log(`Configuration:`, CONFIG);
console.log(`Council member sync interval: ${CONFIG.scrapeInterval} (every hour)`);
console.log(`Google Sheets sync interval: 0 * * * * (every hour)`);

cron.schedule(CONFIG.scrapeInterval, runAllScrapers);
cron.schedule('0 * * * *', runGoogleSheetsSync); // Every hour at minute 0

console.log('Running initial scrape...');
runAllScrapers();

console.log('Running initial Google Sheets sync...');
runGoogleSheetsSync();

process.on('SIGINT', () => {
  console.log('\nScheduler shutting down...');
  process.exit(0);
});


import cron from 'node-cron';
import { scrapeRaiderIOApplicants } from './raiderio-scraper.js';
import { scrapeWoWGuilds } from './wow-guilds-scraper.js';
import { scrapeWarcraftBlogs } from './blogs-scraper.js';

const CONFIG = {
  guildName: process.env.GUILD_NAME || 'YourGuild',
  realm: process.env.REALM || 'Area-52',
  region: process.env.REGION || 'us',
  scrapeInterval: process.env.SCRAPE_INTERVAL || '0 */6 * * *'
};

async function runAllScrapers() {
  console.log(`[${new Date().toISOString()}] Starting scheduled scrape...`);
  
  try {
    await Promise.all([
      scrapeRaiderIOApplicants(CONFIG.guildName, CONFIG.realm, CONFIG.region),
      scrapeWoWGuilds(CONFIG.realm, CONFIG.region),
      scrapeWarcraftBlogs()
    ]);
    
    console.log(`[${new Date().toISOString()}] Scrape completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during scrape:`, error.message);
  }
}

console.log('Scheduler initialized');
console.log(`Configuration:`, CONFIG);
console.log(`Scrape interval: ${CONFIG.scrapeInterval} (every 6 hours)`);

cron.schedule(CONFIG.scrapeInterval, runAllScrapers);

console.log('Running initial scrape...');
runAllScrapers();

process.on('SIGINT', () => {
  console.log('\nScheduler shutting down...');
  process.exit(0);
});


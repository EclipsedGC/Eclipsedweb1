import 'dotenv/config';
import { scrapeWarcraftLogsTeamUrl, enhanceRoster } from './warcraft-logs-team-scraper.js';
import { getGuildTeamLeads } from './blizzard-api.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Create Dark Matter team from guild URL
 * Team Name: Dark Matter
 * Warcraft Logs URL: https://www.warcraftlogs.com/guild/id/694290
 * Raid Leader: Ratayu (from Team Leads)
 */
export async function createDarkMatterTeam() {
  console.log('Creating Dark Matter team...');
  
  try {
    // Get Team Leads to find Ratayu
    const teamLeads = await getGuildTeamLeads('Eclipsed', 'Stormrage', 'us', 2);
    const ratayu = teamLeads.find(lead => 
      (lead.name || '').toLowerCase().includes('ratayu') || 
      (lead.characterName || '').toLowerCase().includes('ratayu')
    );
    
    if (!ratayu) {
      console.error('❌ Could not find Ratayu in Team Leads. Please ensure Ratayu is rank 2 in Eclipsed-US-Stormrage');
      return null;
    }
    
    console.log(`✅ Found Raid Leader: ${ratayu.name} (${ratayu.class})`);
    
    // Scrape roster from guild URL
    const guildUrl = 'https://www.warcraftlogs.com/guild/id/694290';
    console.log(`Scraping roster from ${guildUrl}...`);
    const scrapedData = await scrapeWarcraftLogsTeamUrl(guildUrl);
    
    if (!scrapedData || !scrapedData.roster || scrapedData.roster.length === 0) {
      console.error('❌ No roster data scraped from guild URL');
      return null;
    }
    
    console.log(`✅ Scraped ${scrapedData.roster.length} players from guild page`);
    
    // Enhance roster with Blizzard API data (includes role detection via specialization)
    console.log('Enhancing roster with Blizzard API (this may take a while)...');
    const enhancedRoster = await enhanceRoster(scrapedData.roster);
    
    // Generate team ID
    const teamId = randomUUID();
    
    // Create team object
    const team = {
      teamId: teamId,
      teamName: 'Dark Matter',
      warcraftLogsTeamUrl: guildUrl,
      raidLeader: {
        name: ratayu.name,
        characterName: ratayu.characterName || ratayu.name,
        realm: ratayu.realm || 'Stormrage',
        region: ratayu.region || 'US',
        class: ratayu.class || '',
        avatar: ratayu.avatar || '',
        warcraftLogsUrl: ratayu.warcraftLogsUrl || ''
      },
      roster: enhancedRoster,
      progress: scrapedData.progress || {
        currentTier: 'Manaforge Omega',
        bossesKilled: null,
        totalBosses: 8,
        highestDifficulty: null,
        lastLogUpdate: null
      },
      lastUpdated: new Date().toISOString()
    };
    
    // Save to teams-editor.json
    const filePath = join(DATA_DIR, 'teams-editor.json');
    let teamsData = { teams: [], lastUpdated: null };
    
    if (existsSync(filePath)) {
      teamsData = JSON.parse(readFileSync(filePath, 'utf8'));
      // Check if Dark Matter already exists, remove it if it does
      teamsData.teams = teamsData.teams.filter(t => t.teamName !== 'Dark Matter');
    }
    
    // Add Dark Matter as the first team (at index 0)
    teamsData.teams.unshift(team);
    teamsData.lastUpdated = new Date().toISOString();
    
    writeFileSync(filePath, JSON.stringify(teamsData, null, 2));
    console.log(`✅ Dark Matter team created and saved to ${filePath}`);
    console.log(`   Team ID: ${teamId}`);
    console.log(`   Roster size: ${enhancedRoster.length} players`);
    console.log(`   Raid Leader: ${ratayu.name}`);
    
    return team;
  } catch (error) {
    console.error('❌ Error creating Dark Matter team:', error);
    throw error;
  }
}

// Allow script to be run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createDarkMatterTeam()
    .then(team => {
      if (team) {
        console.log('\n✅ Dark Matter team created successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Failed to create Dark Matter team');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

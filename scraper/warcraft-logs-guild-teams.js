import 'dotenv/config';
import axios from 'axios';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCharacterProfile, getCharacterMedia } from './blizzard-api.js';
import { getCharacterRankings } from './warcraft-logs-api.js';

// Add stealth plugin to bypass detection
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Warcraft Logs Guild ID for Eclipsed
const ECLIPSED_GUILD_ID = 644688;
const WARCRAFT_LOGS_GUILD_URL = `https://www.warcraftlogs.com/guild/id/${ECLIPSED_GUILD_ID}`;

/**
 * Scrape Warcraft Logs guild page to get teams and roster information
 * @returns {Promise<Object>} Guild teams data with rosters
 */
export async function scrapeWarcraftLogsGuildTeams() {
  console.log(`[${new Date().toISOString()}] Scraping Warcraft Logs guild teams from ${WARCRAFT_LOGS_GUILD_URL}...`);
  
  const teams = [];
  let browser = null;

  try {
    // Launch browser with stealth plugin and optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Block unnecessary resources to speed up page load significantly
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      // Block images, fonts, stylesheets, and media to speed up loading
      // We only need the HTML structure, not visual assets
      if (['image', 'font', 'stylesheet', 'media', 'websocket'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to Warcraft Logs guild page...');
    // Use domcontentloaded instead of networkidle2 for much faster loading
    await page.goto(WARCRAFT_LOGS_GUILD_URL, { 
      waitUntil: 'domcontentloaded', // Changed from networkidle2 - much faster
      timeout: 30000 // Reduced from 60s to 30s
    });

    // Reduced wait time - only wait 1 second for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if we hit any blocking (Cloudflare, etc.) - reduced wait time
    const pageContent = await page.content();
    if (pageContent.includes('Just a moment') || pageContent.includes('Verify you are human')) {
      console.log('Waiting for challenge to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 5s to 2s
    }

    // Get page content and parse with Cheerio
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('Parsing guild page structure...');

    // Try to find team sections - Warcraft Logs structure may vary
    // Common patterns: team cards, roster sections, tab content
    
    // Strategy 1: Look for roster/team sections in the page
    // Warcraft Logs might display teams in various ways:
    // - Tabs for different teams
    // - Accordion sections
    // - Card-based layout
    // - Table rows

    // Try to extract guild name
    const guildName = $('h1').first().text().trim() || 'Eclipsed';
    console.log(`Guild name: ${guildName}`);

    // Warcraft Logs page structure for guild teams:
    // Teams are typically shown in tabs or sections. Let's look for:
    // 1. Tabs/navigation that indicate different teams
    // 2. Sections with team names as headers
    // 3. Tables or lists grouped by team
    
    // Strategy: First try to find tabs/buttons that indicate teams, then extract characters from each
    const teamTabs = $('[role="tab"], .tab, .nav-tab, button[data-team], a[href*="#team"]').toArray();
    console.log(`Found ${teamTabs.length} potential team tabs`);
    
    // Extract all character links
    const characterLinks = $('a[href*="/character/"]').toArray();
    console.log(`Found ${characterLinks.length} character links on page`);
    
    // Group characters by finding nearby team identifiers or sections
    const teamMap = new Map(); // teamName -> roster array
    const processedChars = new Set();
    
    // If we found tabs, try clicking through them to get teams
    // Otherwise, try to group by sections/containers
    let teamNames = [];
    
    if (teamTabs.length > 0) {
      // Extract team names from tabs
      teamTabs.forEach(tab => {
        const $tab = $(tab);
        const tabText = $tab.text().trim();
        const dataTeam = $tab.attr('data-team') || $tab.attr('data-team-name');
        const href = $tab.attr('href');
        
        let teamName = tabText || dataTeam || '';
        if (href && href.includes('#')) {
          // Extract from hash fragment
          const hashMatch = href.match(/#(.+)/);
          if (hashMatch) {
            teamName = hashMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          }
        }
        
        if (teamName && teamName.length > 0 && teamName.length < 50) {
          teamNames.push(teamName);
        }
      });
    }
    
    // Also look for team names in section headers (h2, h3, h4)
    const sectionHeaders = $('h2, h3, h4').toArray();
    sectionHeaders.forEach(header => {
      const $header = $(header);
      const headerText = $header.text().trim();
      // Filter out generic headers like "Roster", "Members", etc.
      if (headerText && headerText.length > 0 && headerText.length < 50 && 
          !headerText.toLowerCase().includes('roster') && 
          !headerText.toLowerCase().includes('member') &&
          !headerText.toLowerCase().includes('guild')) {
        teamNames.push(headerText);
      }
    });
    
    // Remove duplicates and normalize
    teamNames = [...new Set(teamNames.map(name => name.trim()))].filter(n => n.length > 0);
    console.log(`Extracted ${teamNames.length} potential team names:`, teamNames);
    
    // Now extract all characters and try to associate them with teams
    for (const link of characterLinks.slice(0, 200)) { // Limit to first 200
      const $link = $(link);
      const href = $link.attr('href');
      const linkText = $link.text().trim();

      // Parse character URL
      const charMatch = href.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
      if (!charMatch) continue;
      
      const [, region, realm, charName] = charMatch;
      const charKey = `${region}-${realm}-${charName}`.toLowerCase();
      
      if (processedChars.has(charKey) || !charName || charName.length === 0 || charName.length >= 20) {
        continue;
      }
      
      processedChars.add(charKey);
      
      // Try to find team name by looking at parent elements and nearby headers
      let teamName = null;
      const $parent = $link.parent();
      let $current = $parent;
      
      // Look up the DOM tree for team identifiers
      for (let i = 0; i < 8 && $current.length > 0; i++) {
        // Check for nearby headings
        const $prevSibling = $current.prevAll('h2, h3, h4').first();
        if ($prevSibling.length > 0) {
          const headingText = $prevSibling.text().trim();
          if (headingText && headingText.length > 0 && headingText.length < 50) {
            // Check if it matches one of our known team names
            const matchingTeam = teamNames.find(tn => headingText.toLowerCase().includes(tn.toLowerCase()) || tn.toLowerCase().includes(headingText.toLowerCase()));
            if (matchingTeam) {
              teamName = matchingTeam;
              break;
            }
          }
        }
        
        // Check for team identifier in current element
        const dataTeam = $current.attr('data-team-name') || $current.attr('data-team') || $current.attr('id');
        if (dataTeam) {
          const matchingTeam = teamNames.find(tn => dataTeam.toLowerCase().includes(tn.toLowerCase().replace(/\s/g, '-')) || tn.toLowerCase().includes(dataTeam.toLowerCase()));
          if (matchingTeam) {
            teamName = matchingTeam;
            break;
          }
        }
        
        // Check parent's class for team indicators
        const classList = $current.attr('class') || '';
        if (classList.includes('team') || classList.includes('roster') || classList.includes('tab-pane')) {
          const text = $current.find('.team-name, .name, h2, h3, h4').first().text().trim();
          if (text) {
            const matchingTeam = teamNames.find(tn => text.toLowerCase().includes(tn.toLowerCase()) || tn.toLowerCase().includes(text.toLowerCase()));
            if (matchingTeam) {
              teamName = matchingTeam;
              break;
            }
          }
        }
        
        $current = $current.parent();
      }
      
      // If no team found but we have team names, assign to first team or create numbered teams
      if (!teamName) {
        // Try to evenly distribute across teams
        const teamIndex = processedChars.size % Math.max(teamNames.length, 8);
        if (teamNames.length > 0 && teamIndex < teamNames.length) {
          teamName = teamNames[teamIndex];
        } else {
          // Create numbered teams if we haven't identified specific ones
          const teamNum = Math.floor(processedChars.size / 10) + 1;
          teamName = `Team ${teamNum}`;
          if (teamNum <= 8 && !teamNames.includes(teamName)) {
            teamNames.push(teamName);
          }
        }
      }
      
      // Normalize team name
      teamName = teamName.replace(/[^\w\s-]/g, '').trim() || 'Main Raid Team';
      
      const characterName = charName;
      const realmName = realm.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const regionName = region.toUpperCase();

      const playerData = {
        characterName: characterName,
        name: linkText || characterName,
        realm: realmName,
        region: regionName,
        warcraftLogsUrl: href.startsWith('http') ? href : `https://www.warcraftlogs.com${href}`,
        class: '',
        level: '',
        avatar: '',
        overallRanking: null,
        highestBossKill: null,
        highestBossKillDifficulty: null
      };
      
      // Add to team map
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, []);
      }
      teamMap.get(teamName).push(playerData);
    }

    console.log(`Found ${teamMap.size} teams with ${processedChars.size} total characters`);
    
    // Convert team map to teams array
    let teamIndex = 0;
    for (const [teamName, roster] of teamMap.entries()) {
      teams.push({
        teamId: `team-${teamIndex++}`,
        teamName: teamName,
        guildId: ECLIPSED_GUILD_ID,
        guildName: guildName,
        roster: roster,
        progress: {
          currentTier: 'Manaforge Omega',
          bossesKilled: null,
          totalBosses: 8,
          difficulty: null,
          lastUpdated: null
        },
        lastUpdated: new Date().toISOString()
      });
    }
    
    // If no teams found, create a default one with all characters
    if (teams.length === 0 && processedChars.size > 0) {
      const allRoster = Array.from(processedChars).map(key => {
        // Rebuild player data from the links we processed
        const link = characterLinks.find(l => {
          const $l = $(l);
          const href = $l.attr('href');
          const match = href.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
          return match && `${match[1]}-${match[2]}-${match[3]}`.toLowerCase() === key;
        });
        if (!link) return null;
        const $link = $(link);
        const href = $link.attr('href');
        const linkText = $link.text().trim();
        const match = href.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
        const [, region, realm, charName] = match;
        const realmName = realm.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return {
          characterName: charName,
          name: linkText || charName,
          realm: realmName,
          region: region.toUpperCase(),
          warcraftLogsUrl: href.startsWith('http') ? href : `https://www.warcraftlogs.com${href}`,
          class: '',
          level: '',
          avatar: '',
          overallRanking: null,
          highestBossKill: null,
          highestBossKillDifficulty: null
        };
      }).filter(p => p !== null);
      
      teams.push({
        teamId: 'main-raid-team',
        teamName: 'Main Raid Team',
        guildId: ECLIPSED_GUILD_ID,
        guildName: guildName,
        roster: allRoster,
        progress: {
          currentTier: 'Manaforge Omega',
          bossesKilled: null,
          totalBosses: 8,
          difficulty: null,
          lastUpdated: null
        },
        lastUpdated: new Date().toISOString()
      });
    }

    // Close browser
    await browser.close();

    const totalPlayers = teams.reduce((sum, team) => sum + (team.roster?.length || 0), 0);
    console.log(`✅ Successfully scraped ${teams.length} teams with ${totalPlayers} total characters`);

    // Enhance rosters with Blizzard API data (avatars, class, level)
    // This is important for displaying avatars and class colors
    if (teams.length > 0) {
      console.log('Enhancing rosters with Blizzard API data (avatars, class, level)...');
      try {
        const enhancedTeams = await enhanceTeamRosters(teams);
        teams = enhancedTeams;
        console.log(`✅ Enhanced ${teams.length} teams with Blizzard API data`);
      } catch (enhanceError) {
        console.error('Error enhancing teams with Blizzard API:', enhanceError.message);
        console.log('Continuing with basic data (without avatars/class info)');
      }
    }

    const result = {
      teams: teams,
      lastUpdated: new Date().toISOString(),
      source: 'Warcraft Logs Scraper + Blizzard API',
      guildId: ECLIPSED_GUILD_ID,
      guildName: guildName
    };

    // Save to file
    const filePath = join(DATA_DIR, 'guild-teams.json');
    writeFileSync(filePath, JSON.stringify(result, null, 2));
    console.log(`✅ Saved guild teams data to ${filePath}`);

    return result;

  } catch (error) {
    console.error(`❌ Error scraping Warcraft Logs guild teams:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    // Return empty structure on error
    return {
      teams: [],
      lastUpdated: new Date().toISOString(),
      source: 'Warcraft Logs Scraper (Error)',
      error: error.message,
      guildId: ECLIPSED_GUILD_ID
    };
  }
}

/**
 * Enhance team roster with Blizzard API data (avatars, class, level) and Warcraft Logs data
 * @param {Array} teams - Teams array with roster
 * @returns {Promise<Array>} Enhanced teams with full character data
 */
export async function enhanceTeamRosters(teams) {
  console.log(`Enhancing ${teams.length} teams with Blizzard API and Warcraft Logs data...`);
  
  for (const team of teams) {
    if (!team.roster || !Array.isArray(team.roster)) continue;

    console.log(`  Enhancing roster for ${team.teamName} (${team.roster.length} players)...`);

    for (let i = 0; i < team.roster.length; i++) {
      const player = team.roster[i];
      
      try {
        if (player.realm && player.characterName) {
          const realm = player.realm;
          const characterName = player.characterName;
          const region = player.region || 'US';

          // Get character profile from Blizzard API
          try {
            const characterProfile = await getCharacterProfile(realm, characterName, `profile-${region.toLowerCase()}`);
            
            if (characterProfile) {
              player.class = characterProfile.character_class?.name || player.class || '';
              player.race = characterProfile.race?.name || player.race || '';
              player.level = characterProfile.level?.toString() || player.level || '';
              player.realm = characterProfile.realm?.name || realm;
              
              // Get character media for avatar
              const media = await getCharacterMedia(realm, characterName);
              if (media?.assets) {
                const avatarAsset = media.assets.find(asset => asset.key === 'avatar');
                if (avatarAsset) {
                  player.avatar = avatarAsset.value;
                } else {
                  // Fallback to portrait
                  const portraitAsset = media.assets.find(asset => asset.key === 'inset');
                  if (portraitAsset) {
                    player.avatar = portraitAsset.value;
                  }
                }
              }
            }
          } catch (blizzardError) {
            console.error(`    Blizzard API error for ${characterName}:`, blizzardError.message);
          }

          // Get Warcraft Logs data (progress/ranking)
          try {
            const warcraftLogsData = await getCharacterRankings(
              characterName,
              realm,
              region
            );

            if (warcraftLogsData) {
              if (warcraftLogsData.highestBossKill) {
                player.highestBossKill = warcraftLogsData.highestBossKill.name;
                player.highestBossKillDifficulty = warcraftLogsData.highestBossKill.difficulty;
              }
              if (warcraftLogsData.overallRanking) {
                player.overallRanking = warcraftLogsData.overallRanking.percentile;
                player.overallRankingMetric = warcraftLogsData.overallRanking.metric;
              }
            }
          } catch (warcraftLogsError) {
            console.error(`    Warcraft Logs error for ${characterName}:`, warcraftLogsError.message);
          }

          // Small delay to respect rate limits (reduced from 500ms to 300ms for faster processing)
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`    Error enhancing ${player.characterName}:`, error.message);
      }
    }

    console.log(`  ✅ Enhanced ${team.roster.length} players for ${team.teamName}`);
  }

  return teams;
}

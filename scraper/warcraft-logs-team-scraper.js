import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { getCharacterProfile, getCharacterMedia, getCharacterSpecialization } from './blizzard-api.js';
import { getCharacterRankings } from './warcraft-logs-api.js';

// Add stealth plugin to bypass detection
puppeteer.use(StealthPlugin());

/**
 * Scrape Warcraft Logs team URL to extract roster and progress
 * @param {string} teamUrl - Direct Warcraft Logs team URL
 * @returns {Promise<Object>} Team data with roster and progress
 */
export async function scrapeWarcraftLogsTeamUrl(teamUrl) {
  console.log(`[${new Date().toISOString()}] Scraping Warcraft Logs URL: ${teamUrl}...`);
  
  // Check if this is a guild URL or team URL
  const isGuildUrl = teamUrl.includes('/guild/id/');
  
  let browser = null;

  try {
    // Launch browser with stealth plugin and optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Block unnecessary resources to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media', 'websocket'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log(`Navigating to Warcraft Logs ${isGuildUrl ? 'guild' : 'team'} page...`);
    await page.goto(teamUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for Cloudflare challenge
    const pageContent = await page.content();
    if (pageContent.includes('Just a moment') || pageContent.includes('Verify you are human')) {
      console.log('Waiting for challenge to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Get page content and parse with Cheerio
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log(`Parsing ${isGuildUrl ? 'guild' : 'team'} page structure...`);

    // Extract roster players (works for both guild and team pages)
    const characterLinks = $('a[href*="/character/"]').toArray();
    console.log(`Found ${characterLinks.length} character links on ${isGuildUrl ? 'guild' : 'team'} page`);

    const uniqueCharacters = new Map();
    const roster = [];

    // Extract all unique characters from roster
    for (const link of characterLinks.slice(0, 200)) {
      const $link = $(link);
      const href = $link.attr('href');
      const linkText = $link.text().trim();

      const charMatch = href.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
      if (!charMatch) continue;
      
      const [, region, realm, charName] = charMatch;
      const charKey = `${region}-${realm}-${charName}`.toLowerCase();
      
      if (uniqueCharacters.has(charKey) || !charName || charName.length === 0 || charName.length >= 20) {
        continue;
      }
      
      uniqueCharacters.set(charKey, true);
      
      const characterName = charName;
      const realmName = realm.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const regionName = region.toUpperCase();

      roster.push({
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
      });
    }

    console.log(`Extracted ${roster.length} unique characters from team roster`);

    // Extract latest raid log progress
    // Look for raid reports, boss kills, or progress sections
    let progress = {
      currentTier: 'Manaforge Omega',
      bossesKilled: null,
      totalBosses: 8,
      highestDifficulty: null,
      lastLogUpdate: null
    };

    // Try to find latest raid report or boss kill information
    // Look for report links, boss kill indicators, or progress bars
    const reportLinks = $('a[href*="/reports/"]').toArray();
    if (reportLinks.length > 0) {
      // Try to extract from most recent report link or boss kill info
      const bossKillElements = $('.boss-kill, .encounter-kill, [class*="kill"]').toArray();
      console.log(`Found ${bossKillElements.length} potential boss kill indicators`);
      
      // Look for difficulty indicators
      const difficultyText = $('.difficulty, [class*="mythic"], [class*="heroic"], [class*="normal"]').first().text().trim();
      if (difficultyText) {
        if (difficultyText.toLowerCase().includes('mythic')) {
          progress.highestDifficulty = 'Mythic';
        } else if (difficultyText.toLowerCase().includes('heroic')) {
          progress.highestDifficulty = 'Heroic';
        } else if (difficultyText.toLowerCase().includes('normal')) {
          progress.highestDifficulty = 'Normal';
        }
      }
      
      // Try to count boss kills from boss kill elements or progress indicators
      const bossKills = bossKillElements.length;
      if (bossKills > 0) {
        progress.bossesKilled = bossKills;
      }
    }

    // Close browser
    await browser.close();

    console.log(`✅ Successfully scraped team roster: ${roster.length} players`);

    return {
      roster: roster,
      progress: progress,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Error scraping Warcraft Logs team URL:`, error.message);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // Ignore close errors
      }
    }

    throw error;
  }
}

/**
 * Enhance roster with Blizzard API data (avatars, class, level) and Warcraft Logs rankings
 * @param {Array} roster - Roster array from scraping
 * @returns {Promise<Array>} Enhanced roster with full character data
 */
export async function enhanceRoster(roster) {
  console.log(`Enhancing roster of ${roster.length} players with Blizzard API and Warcraft Logs data (parallel processing)...`);
  
  // Process players in parallel batches to speed up (batch size of 5 to avoid rate limits)
  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < roster.length; i += BATCH_SIZE) {
    batches.push(roster.slice(i, i + BATCH_SIZE));
  }
  
  // Helper function to enhance a single player
  async function enhancePlayer(player) {
    if (!player.realm || !player.characterName) {
      return player;
    }
    
    const realm = player.realm;
    const characterName = player.characterName;
    const region = player.region || 'US';
    const regionLower = region.toLowerCase();
    const namespace = `profile-${regionLower}`;

    try {
      // Get character profile from Blizzard API (CRITICAL: Must fetch class data even if avatar fails)
      try {
        const characterProfile = await getCharacterProfile(realm, characterName, namespace);
        
        if (characterProfile) {
          // Always set class from Blizzard API (important for fallback avatar colors)
          player.class = characterProfile.character_class?.name || player.class || '';
          player.race = characterProfile.race?.name || player.race || '';
          player.level = characterProfile.level?.toString() || player.level || '';
          player.realm = characterProfile.realm?.name || realm;
          
          // Fetch specialization, media, and Warcraft Logs data in parallel for fastest processing
          const [specialization, media, warcraftLogsData] = await Promise.all([
            getCharacterSpecialization(realm, characterName, namespace).catch(() => null),
            getCharacterMedia(realm, characterName).catch(() => null),
            getCharacterRankings(characterName, realm, region).catch(() => null)
          ]);
          
          // Process specialization for role
          if (specialization?.specializations && Array.isArray(specialization.specializations)) {
            const activeSpec = specialization.specializations.find(s => s.active) || specialization.specializations[0];
            if (activeSpec?.specialization?.role?.type) {
              const roleType = activeSpec.specialization.role.type.toUpperCase();
              if (roleType === 'TANK') {
                player.role = 'Tank';
              } else if (roleType === 'HEALER' || roleType === 'HEALING') {
                player.role = 'Healer';
              } else {
                player.role = 'DPS';
              }
            } else {
              player.role = 'DPS';
            }
          } else {
            player.role = 'DPS';
          }
          
          // Process media for avatar
          if (media?.assets) {
            const avatarAsset = media.assets.find(asset => asset.key === 'avatar');
            if (avatarAsset) {
              player.avatar = avatarAsset.value;
            } else {
              const portraitAsset = media.assets.find(asset => asset.key === 'inset');
              player.avatar = portraitAsset?.value || '';
            }
          } else {
            player.avatar = '';
          }
          
          // Process Warcraft Logs data
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
        } else {
          player.avatar = '';
        }
      } catch (blizzardError) {
        console.error(`    Blizzard API error for ${characterName}:`, blizzardError.message);
        player.avatar = '';
      }
      
      // Ensure role is always set
      if (!player.role) {
        player.role = 'DPS';
      }
      
    } catch (error) {
      console.error(`    Error enhancing ${characterName}:`, error.message);
    }
    
    return player;
  }
  
  // Process batches sequentially, but players within each batch in parallel
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`  Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} players)...`);
    
    // Process all players in this batch in parallel
    await Promise.all(batch.map(player => enhancePlayer(player)));
    
    // Small delay between batches to respect rate limits (reduced from 300ms per player to 100ms per batch)
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ Enhanced ${roster.length} players`);
  return roster;
}

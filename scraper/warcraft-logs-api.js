import 'dotenv/config';
import axios from 'axios';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Warcraft Logs API Configuration
// Get your API key from: https://www.warcraftlogs.com/api/clients
const WARCRAFT_LOGS_CLIENT_ID = process.env.WARCRAFT_LOGS_CLIENT_ID || '';
const WARCRAFT_LOGS_CLIENT_SECRET = process.env.WARCRAFT_LOGS_CLIENT_SECRET || '';

const WARCRAFT_LOGS_API_URL = 'https://www.warcraftlogs.com/api/v2/client';

let cachedAccessToken = null;
let tokenExpiry = null;

// The War Within Season 3 zone IDs (current retail expansion)
// Season 3 started August 12, 2025
// These are the zone IDs for current expansion raids/dungeons
const CURRENT_EXPANSION_ZONE_IDS = [
  // Manaforge Omega raid (The War Within Season 3)
  // Zone IDs will be added here once verified from API responses
  // For now, we use zone name and date filtering
];

// Zone names that indicate The War Within Season 3 content
const CURRENT_EXPANSION_ZONE_NAMES = [
  'Manaforge Omega',        // Season 3 raid
  'Eco-Dome Al\'dani',      // Season 3 dungeon
  'The War Within',
  'War Within',
  'TWW',
];

/**
 * Check if a zone belongs to The War Within Season 3 (current retail expansion)
 * Season 3 started August 12, 2025
 */
function isCurrentExpansionZone(zoneId, zoneName) {
  // If zone ID list is populated, check against it
  if (CURRENT_EXPANSION_ZONE_IDS.length > 0 && zoneId) {
    return CURRENT_EXPANSION_ZONE_IDS.includes(zoneId);
  }
  
  // Check zone name for current expansion keywords (The War Within Season 3)
  if (zoneName) {
    const zoneNameLower = zoneName.toLowerCase();
    
    // First, check for known old expansion names to exclude them
    // NOTE: "Manaforge Omega" is CURRENT content (The War Within Season 3), NOT old content
    const oldExpansionKeywords = [
      'legion', 'broken isles', 'nighthold', 'tomb of sargeras', 'antorus',
      'battle for azeroth', 'bfa', 'uldir', 'battle of dazar\'alor', 'crucible of storms', 'eternal palace', 'ny\'alotha',
      'shadowlands', 'castle nathria', 'sanctum of domination', 'sepulcher of the first ones',
      'dragonflight', 'vault of the incarnates', 'aberrus', 'amirdrassil',
      'warlords of draenor', 'wod', 'highmaul', 'blackrock foundry', 'hellfire citadel',
      'mists of pandaria', 'mop', 'heart of fear', 'terrace of endless spring', 'throne of thunder', 'siege of orgrimmar',
      'cataclysm', 'blackwing descent', 'firelands', 'dragon soul',
      'wrath of the lich king', 'wotlk', 'naxxramas', 'ulduar', 'trial of the crusader', 'icecrown citadel', 'ruby sanctum',
      'skorpyron' // Legacy Legion content from old expansions
    ];
    
    // If it's an old expansion zone, return false
    if (oldExpansionKeywords.some(keyword => zoneNameLower.includes(keyword))) {
      return false;
    }
    
    // Check for current expansion keywords (case-insensitive)
    return CURRENT_EXPANSION_ZONE_NAMES.some(keyword => 
      zoneNameLower.includes(keyword.toLowerCase())
    );
  }
  
  // If no zone info, return null (unknown - will need date-based filtering)
  return null;
}

/**
 * Check if a report timestamp is from The War Within Season 3 era
 * The War Within Season 3 started August 12, 2025
 * Filter reports from 2025-08-12 onwards (Season 3 release date)
 */
function isCurrentExpansionReport(timestamp) {
  if (!timestamp) return false;
  // The War Within Season 3 started August 12, 2025
  // Filter for reports from 2025-08-12 onwards
  const warWithinSeason3StartDate = new Date('2025-08-12').getTime();
  return timestamp >= warWithinSeason3StartDate;
}

/**
 * Get OAuth access token from Warcraft Logs API
 * Uses client credentials flow
 */
async function getAccessToken() {
  // Check if we have a valid cached token
  if (cachedAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

    if (!WARCRAFT_LOGS_CLIENT_ID || !WARCRAFT_LOGS_CLIENT_SECRET) {
      console.log('⚠️  Warcraft Logs API credentials not configured. Set WARCRAFT_LOGS_CLIENT_ID and WARCRAFT_LOGS_CLIENT_SECRET environment variables.');
      console.log(`   CLIENT_ID present: ${!!WARCRAFT_LOGS_CLIENT_ID}`);
      console.log(`   CLIENT_SECRET present: ${!!WARCRAFT_LOGS_CLIENT_SECRET}`);
      return null;
    }

  try {
    console.log('Fetching Warcraft Logs API access token...');
    
    // Warcraft Logs uses form-encoded data for token request
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', WARCRAFT_LOGS_CLIENT_ID);
    params.append('client_secret', WARCRAFT_LOGS_CLIENT_SECRET);
    
    const response = await axios.post(
      'https://www.warcraftlogs.com/oauth/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.data && response.data.access_token) {
      cachedAccessToken = response.data.access_token;
      // Tokens typically expire in 1 hour, cache for 55 minutes to be safe
      tokenExpiry = Date.now() + (response.data.expires_in || 3600 - 300) * 1000;
      console.log('✅ Warcraft Logs API access token obtained');
      return cachedAccessToken;
    }

    throw new Error('No access token in response');
  } catch (error) {
    console.error('Error fetching Warcraft Logs API token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

/**
 * Query Warcraft Logs GraphQL API
 */
async function queryGraphQL(query, variables = {}) {
  try {
    const token = await getAccessToken();
    if (!token) {
      return null;
    }

    const response = await axios.post(
      WARCRAFT_LOGS_API_URL,
      {
        query: query,
        variables: variables
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data && response.data.data) {
      return response.data.data;
    }

    if (response.data && response.data.errors) {
      console.error('❌ Warcraft Logs GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
      return null;
    }

    console.log('⚠️  Warcraft Logs API response missing data field:', response.data);
    return null;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Error querying Warcraft Logs API: ${error.response.status} - ${error.response.statusText}`);
      if (error.response.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      if (error.response.status === 404) {
        console.log('  Character not found in Warcraft Logs');
      }
    } else {
      console.error(`❌ Error querying Warcraft Logs API:`, error.message);
      if (error.stack) {
        console.error('Stack:', error.stack);
      }
    }
    return null;
  }
}

/**
 * Get character rankings and highest boss kill from Warcraft Logs
 * @param {string} characterName - Character name
 * @param {string} realmName - Realm name (e.g., 'Stormrage')
 * @param {string} region - Region (e.g., 'US', 'EU')
 * @returns {Promise<Object>} Character ranking data with highest boss kill
 */
export async function getCharacterRankings(characterName, realmName, region = 'US') {
  try {
    // Convert region format: 'US' -> 'us', 'EU' -> 'eu'
    const regionLower = region.toUpperCase() === 'US' ? 'us' : region.toLowerCase();
    
    // Warcraft Logs uses server slug format for realms (lowercase, hyphens)
    const realmSlug = realmName.toLowerCase().replace(/\s+/g, '-');
    // Try exact character name first (case-sensitive in Warcraft Logs)
    let characterNameToUse = characterName;

    console.log(`Fetching Warcraft Logs data for "${characterName}" on ${realmName} (The War Within Season 3 only)...`);

    // GraphQL query to get character rankings and encounters
    // Filtered to ONLY include The War Within Season 3 (current retail expansion)
    // Using correct Warcraft Logs API v2 schema
    const query = `
      query getCharacterRankings($characterName: String!, $serverSlug: String!, $serverRegion: String!) {
        characterData {
          character(name: $characterName, serverSlug: $serverSlug, serverRegion: $serverRegion) {
            name
            server {
              name
              region {
                name
              }
            }
            zoneRankings
            recentReports(limit: 50) {
              data {
                code
                startTime
                endTime
                zone {
                  id
                  name
                }
                fights(killType: Kills) {
                  id
                  encounterID
                  name
                  difficulty
                  kill
                }
              }
            }
          }
        }
        rateLimitData {
          limitPerHour
          pointsSpentThisHour
          pointsResetIn
        }
      }
    `;

    // Try multiple character name variations
    const nameVariations = [
      characterName,              // Original name
      characterName.toLowerCase(), // Lowercase
      characterName.toUpperCase(), // Uppercase
    ];

    let data = null;
    let workingName = null;

    // Try each name variation until we find one that works
    for (const nameVar of nameVariations) {
      const variables = {
        characterName: nameVar,
        serverSlug: realmSlug,
        serverRegion: regionLower
      };

      console.log(`  Trying character name: "${nameVar}"...`);
      data = await queryGraphQL(query, variables);
      
      if (data && data.characterData && data.characterData.character) {
        workingName = nameVar;
        console.log(`  ✅ Found character with name: "${nameVar}"`);
        break;
      }
    }
    
    // If still not found, character doesn't exist in Warcraft Logs or has no logs
    if (!data || !data.characterData || !data.characterData.character) {
      console.log(`  ⚠️  Character "${characterName}" not found in Warcraft Logs for ${realmName}`);
      console.log(`  This could mean:`);
      console.log(`    - Character has no logs uploaded`);
      console.log(`    - Character name/realm spelling doesn't match exactly`);
      console.log(`    - Character logs are private`);
      return null;
    }

    const character = data.characterData.character;
    console.log(`  ✅ Character found in Warcraft Logs: ${character.name}`);
    
    // Extract highest difficulty boss kill from recent reports
    // ONLY include data from The War Within Season 3 (current retail expansion)
    // Filter out all old expansion data
    let highestBossKill = null;
    let highestDifficulty = 0;
    let allRaidKills = []; // Collect all raid kills for better selection (current expansion only)
    
    if (character.recentReports && character.recentReports.data && character.recentReports.data.length > 0) {
      console.log(`  📊 Processing ${character.recentReports.data.length} reports, filtering for The War Within Season 3 only...`);
      
      // Loop through recent reports and find highest difficulty raid boss kill
      // ONLY from The War Within Season 3 zones
      let filteredReports = 0;
      for (const report of character.recentReports.data) {
        // Filter by zone ID/name and report date to ensure only current expansion
        const zoneId = report.zone?.id || null;
        const zoneName = report.zone?.name || null;
        const reportDate = report.startTime || null;
        
        // Check if this report is from current expansion
        const isCurrentExpansion = isCurrentExpansionZone(zoneId, zoneName);
        const isRecentEnough = isCurrentExpansionReport(reportDate);
        
        // Only process if it's confirmed current expansion, or if zone info is missing, use date-based filtering
        if (!isCurrentExpansion && isCurrentExpansion !== null) {
          // Zone is known and is NOT current expansion, skip it
          continue;
        }
        
        if (!isRecentEnough && reportDate) {
          // Report is too old to be from The War Within Season 3 (before Aug 12, 2025), skip it
          continue;
        }
        
        // If zone is unknown (null) and date is also missing/invalid, skip to be safe
        if (isCurrentExpansion === null && !isRecentEnough) {
          // Unknown zone and not recent enough - skip to avoid old content
          continue;
        }
        
        // If we get here, process this report
        filteredReports++;
        
        if (report && report.fights && Array.isArray(report.fights) && report.fights.length > 0) {
          for (const fight of report.fights) {
            // Only count actual kills (kill: true)
            // Filter out dungeon encounters (difficulty 10) for "highest boss kill"
            // Focus on raid difficulties: 1=LFR, 2=Normal, 3=Heroic, 4=Mythic, 23=Mythic, 24=Heroic, 25=Normal
            if (fight && fight.kill === true && fight.difficulty) {
              const isRaidDifficulty = fight.difficulty <= 4 || (fight.difficulty >= 23 && fight.difficulty <= 25);
              
              if (isRaidDifficulty) {
                // Normalize difficulty for comparison
                let normalizedDifficulty = fight.difficulty;
                if (fight.difficulty === 23) normalizedDifficulty = 4; // Mythic
                if (fight.difficulty === 24) normalizedDifficulty = 3; // Heroic  
                if (fight.difficulty === 25) normalizedDifficulty = 2; // Normal
                
                // Store all raid kills with zone info (already filtered to current expansion)
                allRaidKills.push({
                  name: fight.name || 'Unknown Boss',
                  difficulty: getDifficultyName(fight.difficulty),
                  difficultyId: fight.difficulty,
                  normalizedDifficulty: normalizedDifficulty,
                  encounterId: fight.encounterID,
                  reportCode: report.code,
                  startTime: report.startTime,
                  zoneId: zoneId,
                  zoneName: zoneName,
                  fightIndex: fight.id || null // Fight ID for direct linking
                });
                
                // Track highest difficulty
                if (normalizedDifficulty > highestDifficulty) {
                  highestDifficulty = normalizedDifficulty;
                }
              }
            }
          }
        }
      }
      
      console.log(`  ✅ Filtered to ${filteredReports} reports from The War Within Season 3 (from ${character.recentReports.data.length} total), found ${allRaidKills.length} raid boss kills`);
      
      // Find the highest difficulty boss kill
      // Priority: 1) Highest difficulty, 2) Most recent (if same difficulty)
      if (allRaidKills.length > 0) {
        const highestDifficultyKills = allRaidKills.filter(k => k.normalizedDifficulty === highestDifficulty);
        // Sort by startTime (most recent first) and take the first one
        highestDifficultyKills.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
        if (highestDifficultyKills.length > 0) {
          const bestKill = highestDifficultyKills[0];
          // Build direct link to the specific fight in the report
          // The fight.id from the API is the sequential fight number in the report
          const fightUrl = bestKill.reportCode && bestKill.fightIndex
            ? `https://www.warcraftlogs.com/reports/${bestKill.reportCode}#fight=${bestKill.fightIndex}`
            : bestKill.reportCode 
              ? `https://www.warcraftlogs.com/reports/${bestKill.reportCode}`
              : null;
          
          highestBossKill = {
            name: bestKill.name,
            difficulty: bestKill.difficulty,
            difficultyId: bestKill.difficultyId,
            encounterId: bestKill.encounterId,
            reportCode: bestKill.reportCode,
            fightUrl: fightUrl,
            zoneName: bestKill.zoneName || null,
            startTime: bestKill.startTime // Keep for reference
          };
          
          console.log(`  📊 Highest boss kill: ${bestKill.name} (${bestKill.difficulty})${bestKill.zoneName ? ` - ${bestKill.zoneName}` : ''} - Report: ${bestKill.reportCode || 'N/A'}`);
        }
      }
    }

    // Get overall ranking from zoneRankings
    // zoneRankings is an object (not a string) with structure:
    // { bestPerformanceAverage, medianPerformanceAverage, difficulty, metric, zone, rankings: [{ rankPercent, ... }] }
    // IMPORTANT: Only use zoneRankings if the zone is from The War Within Season 3
    // We want the overall player performance percentile - use bestPerformanceAverage if available
    // Otherwise, aggregate from the rankings array
    let overallRanking = null;
    if (character.zoneRankings) {
      try {
        const rankings = character.zoneRankings;
        const zoneId = rankings.zone || null;
        const zoneName = null; // zoneRankings doesn't always include zone name
        
        // Check if this zoneRankings data is from current expansion
        const isCurrentExpansion = isCurrentExpansionZone(zoneId, zoneName);
        
        // If we have zone ID and it's definitely NOT current expansion, skip it
        if (isCurrentExpansion === false) {
          console.log(`  ⚠️  Skipping zoneRankings - zone ${zoneId} is not from The War Within Season 3`);
        } else {
          console.log(`  📊 Parsing zoneRankings data for The War Within Season 3 (zone: ${zoneId || 'unknown'}, metric: ${rankings.metric || 'unknown'}, difficulty: ${rankings.difficulty || 'unknown'})...`);
          
          let bestPercentile = 0;
          let bestRanking = null;
          let allPercentiles = [];
          
          // First, try to get bestPerformanceAverage (overall performance for this zone/metric/difficulty)
          if (rankings.bestPerformanceAverage && typeof rankings.bestPerformanceAverage === 'number' && rankings.bestPerformanceAverage > 0) {
            bestPercentile = rankings.bestPerformanceAverage;
            bestRanking = {
              percentile: rankings.bestPerformanceAverage,
              difficulty: rankings.difficulty ? getDifficultyName(rankings.difficulty) : 'Overall',
              metric: rankings.metric || 'dps',
              spec: 'All Specs'
            };
            console.log(`  ✅ Found bestPerformanceAverage: ${bestPercentile.toFixed(1)}%`);
          }
          
          // Also try medianPerformanceAverage
          if (rankings.medianPerformanceAverage && typeof rankings.medianPerformanceAverage === 'number' && rankings.medianPerformanceAverage > 0) {
            if (rankings.medianPerformanceAverage > bestPercentile || bestPercentile === 0) {
              bestPercentile = rankings.medianPerformanceAverage;
              bestRanking = {
                percentile: rankings.medianPerformanceAverage,
                difficulty: rankings.difficulty ? getDifficultyName(rankings.difficulty) : 'Overall',
                metric: rankings.metric || 'dps',
                spec: 'All Specs (Median)'
              };
              console.log(`  ✅ Using medianPerformanceAverage: ${bestPercentile.toFixed(1)}%`);
            }
          }
          
          // If no overall average, try to aggregate from individual encounter rankings
          // ONLY include encounters that are confirmed from current expansion zones
          if ((!bestPercentile || bestPercentile === 0) && rankings.rankings && Array.isArray(rankings.rankings)) {
            console.log(`  📊 Aggregating from ${rankings.rankings.length} encounter rankings (The War Within Season 3 only)...`);
            
            for (const encounterRanking of rankings.rankings) {
              if (encounterRanking && typeof encounterRanking === 'object') {
                // Look for rankPercent in encounter rankings
                const rankPercent = encounterRanking.rankPercent || 
                                  encounterRanking.percentile ||
                                  null;
                
                if (rankPercent && typeof rankPercent === 'number' && rankPercent > 0) {
                  allPercentiles.push(rankPercent);
                  if (rankPercent > bestPercentile) {
                    bestPercentile = rankPercent;
                    bestRanking = {
                      percentile: rankPercent,
                      difficulty: rankings.difficulty ? getDifficultyName(rankings.difficulty) : 'Overall',
                      metric: rankings.metric || 'dps',
                      spec: encounterRanking.spec || 'All Specs',
                      encounter: encounterRanking.encounter?.name || null
                    };
                  }
                }
                
                // Also check medianPercent
                const medianPercent = encounterRanking.medianPercent;
                if (medianPercent && typeof medianPercent === 'number' && medianPercent > 0) {
                  allPercentiles.push(medianPercent);
                }
              }
            }
            
            // If we collected percentiles, use average as overall performance
            if (allPercentiles.length > 0) {
              const avgPercentile = allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length;
              if (!bestRanking || avgPercentile > bestPercentile) {
                bestPercentile = avgPercentile;
                bestRanking = {
                  percentile: avgPercentile,
                  difficulty: rankings.difficulty ? getDifficultyName(rankings.difficulty) : 'Overall',
                  metric: rankings.metric || 'dps',
                  spec: 'Average',
                  encounterCount: allPercentiles.length
                };
              }
              console.log(`  ✅ Aggregated average from ${allPercentiles.length} encounters: ${avgPercentile.toFixed(1)}%`);
            }
          }
          
          // Set the overall ranking if we found one (only from current expansion)
          if (bestPercentile > 0 && bestRanking) {
            overallRanking = bestRanking;
            console.log(`  ✅ Overall performance (The War Within Season 3): ${bestPercentile.toFixed(1)}% (${bestRanking.metric.toUpperCase()}, ${bestRanking.difficulty})`);
          } else {
            console.log(`  ⚠️  No valid percentile found in zoneRankings for The War Within Season 3`);
            console.log(`     bestPerformanceAverage: ${rankings.bestPerformanceAverage}`);
            console.log(`     medianPerformanceAverage: ${rankings.medianPerformanceAverage}`);
            console.log(`     rankings array length: ${rankings.rankings?.length || 0}`);
          }
        }
      } catch (parseError) {
        console.log(`  ❌ Error processing zoneRankings: ${parseError.message}`);
        console.log(`     zoneRankings type: ${typeof character.zoneRankings}`);
      }
    } else {
      console.log(`  ⚠️  No zoneRankings data available for character`);
    }

    // Build Warcraft Logs profile URL
    const warcraftLogsRealm = (character.server?.name || realmName).toLowerCase().replace(/\s+/g, '-');
    const warcraftLogsRegionRaw = (character.server?.region?.name || region).toLowerCase();
    const warcraftLogsRegion = warcraftLogsRegionRaw === 'united states' || warcraftLogsRegionRaw === 'us' ? 'us' : warcraftLogsRegionRaw;
    const warcraftLogsCharacterName = (character.name || characterName).toLowerCase();
    const warcraftLogsUrl = `https://www.warcraftlogs.com/character/${warcraftLogsRegion}/${warcraftLogsRealm}/${warcraftLogsCharacterName}`;

    const result = {
      characterName: character.name || characterName,
      realm: character.server?.name || realmName,
      region: character.server?.region?.name || region,
      highestBossKill: highestBossKill,
      overallRanking: overallRanking,
      warcraftLogsUrl: warcraftLogsUrl,
      hasData: !!(highestBossKill || overallRanking)
    };

    if (result.hasData) {
      console.log(`  ✅ Warcraft Logs data found: ${highestBossKill ? `Highest: ${highestBossKill.name} (${highestBossKill.difficulty})` : 'No kills'} | ${overallRanking ? `Ranking: ${overallRanking.percentile?.toFixed(1)}%` : 'No ranking'}`);
    } else {
      console.log(`  ⚠️  Warcraft Logs: Character found but no kill/ranking data available`);
    }
    
    return result;
  } catch (error) {
    console.error(`  Error fetching Warcraft Logs data for ${characterName}:`, error.message);
    return null;
  }
}

/**
 * Convert difficulty ID to readable name
 */
function getDifficultyName(difficultyId) {
  const difficultyMap = {
    1: 'LFR',
    2: 'Normal',
    3: 'Heroic',
    4: 'Mythic',
    5: 'Looking For Group',
    10: 'Mythic+ (Dungeon)', // Dungeon difficulty
    23: 'Mythic', // Sometimes Mythic is 23
    24: 'Heroic', // Sometimes Heroic is 24
    25: 'Normal'  // Sometimes Normal is 25
  };
  return difficultyMap[difficultyId] || `Difficulty ${difficultyId}`;
}

/**
 * Alternative: Get character rankings using a simpler query
 * This is a fallback method if the main query doesn't work
 */
export async function getCharacterRankingsSimple(characterName, realmName, region = 'US') {
  try {
    const regionLower = region.toUpperCase() === 'US' ? 'us' : region.toLowerCase();
    const realmSlug = realmName.toLowerCase().replace(/\s+/g, '-');
    const characterSlug = characterName.toLowerCase();

    // Simpler query focusing on recent activity and rankings
    const query = `
      query getCharacterSimple($characterName: String!, $serverSlug: String!, $serverRegion: String!) {
        characterData {
          character(name: $characterName, serverSlug: $serverSlug, serverRegion: $serverRegion) {
            name
            recentReports(limit: 5) {
              data {
                code
                startTime
                fights {
                  encounterID
                  name
                  difficulty
                  kill
                  size
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      characterName: characterSlug,
      serverSlug: realmSlug,
      serverRegion: regionLower
    };

    const data = await queryGraphQL(query, variables);
    
    if (!data || !data.characterData || !data.characterData.character) {
      return null;
    }

    const character = data.characterData.character;
    let highestBossKill = null;
    let highestDifficulty = 0;

    // Find highest difficulty kill from recent reports
    if (character.recentReports && character.recentReports.data) {
      for (const report of character.recentReports.data) {
        if (report.fights && report.fights.length > 0) {
          for (const fight of report.fights) {
            if (fight.kill && fight.difficulty >= highestDifficulty) {
              highestDifficulty = fight.difficulty;
              highestBossKill = {
                name: fight.name,
                difficulty: getDifficultyName(fight.difficulty),
                difficultyId: fight.difficulty,
                encounterId: fight.encounterID
              };
            }
          }
        }
      }
    }

    return {
      characterName: character.name || characterName,
      highestBossKill: highestBossKill,
      overallRanking: null, // Not available in simple query
      hasData: !!highestBossKill
    };
  } catch (error) {
    console.error(`Error in simple Warcraft Logs query for ${characterName}:`, error.message);
    return null;
  }
}

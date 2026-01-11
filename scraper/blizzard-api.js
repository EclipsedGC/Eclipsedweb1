import 'dotenv/config';
import axios from 'axios';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getCharacterRankings } from './warcraft-logs-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

// Blizzard API Configuration
const BLIZZARD_CLIENT_ID = process.env.BLIZZARD_CLIENT_ID || 'f62cb7e04acf4c9bac065cd5ffd9bb92';
const BLIZZARD_CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET || 'YK3v3f43cyb1VwPJAvqIuKQCAVLUNZk7';
const BLIZZARD_REGION = process.env.BLIZZARD_REGION || 'us';

const API_BASE_URL = `https://${BLIZZARD_REGION}.api.blizzard.com`;
const TOKEN_CACHE_FILE = join(DATA_DIR, 'blizzard-token-cache.json');

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get OAuth access token from Blizzard API
 * Tokens are cached to avoid unnecessary requests
 */
async function getAccessToken() {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  // Try to load from cache file
  if (existsSync(TOKEN_CACHE_FILE)) {
    try {
      const cache = JSON.parse(readFileSync(TOKEN_CACHE_FILE, 'utf8'));
      if (cache.token && cache.expiry && Date.now() < cache.expiry) {
        cachedToken = cache.token;
        tokenExpiry = cache.expiry;
        return cachedToken;
      }
    } catch (error) {
      console.log('Error reading token cache:', error.message);
    }
  }

  try {
    console.log('Fetching new Blizzard API access token...');
    
    // Blizzard uses client credentials flow for most API endpoints
    const response = await axios.post(
      `https://${BLIZZARD_REGION}.battle.net/oauth/token`,
      null,
      {
        params: {
          grant_type: 'client_credentials',
        },
        auth: {
          username: BLIZZARD_CLIENT_ID,
          password: BLIZZARD_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.data && response.data.access_token) {
      cachedToken = response.data.access_token;
      // Tokens typically expire in 24 hours, cache for 23 hours to be safe
      tokenExpiry = Date.now() + (response.data.expires_in - 3600) * 1000;

      // Save to cache file
      writeFileSync(
        TOKEN_CACHE_FILE,
        JSON.stringify({
          token: cachedToken,
          expiry: tokenExpiry,
        }),
        'utf8'
      );

      console.log('✅ Blizzard API access token obtained');
      return cachedToken;
    }

    throw new Error('No access token in response');
  } catch (error) {
    console.error('Error fetching Blizzard API token:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

/**
 * Fetch character profile from Blizzard API
 * @param {string} realm - Realm name (e.g., 'stormrage')
 * @param {string} characterName - Character name (case-insensitive)
 * @param {string} namespace - Namespace (e.g., 'profile-us' for US region)
 * @returns {Promise<Object>} Character profile data
 */
export async function getCharacterProfile(realm, characterName, namespace = null) {
  try {
    const token = await getAccessToken();
    
    // Format realm: lowercase, replace spaces with hyphens
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    // Character name should be lowercase for URL
    const formattedName = characterName.toLowerCase();
    
    // Default namespace if not provided
    if (!namespace) {
      namespace = `profile-${BLIZZARD_REGION}`;
    }

    const url = `${API_BASE_URL}/profile/wow/character/${formattedRealm}/${formattedName}`;
    
    console.log(`Fetching character: ${characterName} on ${realm}...`);
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        console.log(`Character ${characterName} on ${realm} not found`);
      } else {
        console.error(`Error fetching character ${characterName}:`, error.response.status, error.response.statusText);
      }
    } else {
      console.error(`Error fetching character ${characterName}:`, error.message);
    }
    return null;
  }
}

/**
 * Get character media (avatar, render images)
 */
export async function getCharacterMedia(realm, characterName) {
  try {
    const token = await getAccessToken();
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    const formattedName = characterName.toLowerCase();
    const namespace = `profile-${BLIZZARD_REGION}`;

    const url = `${API_BASE_URL}/profile/wow/character/${formattedRealm}/${formattedName}/character-media`;
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`Character media not found for ${characterName}`);
    }
    return null;
  }
}

/**
 * Get character equipment
 */
export async function getCharacterEquipment(realm, characterName) {
  try {
    const token = await getAccessToken();
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    const formattedName = characterName.toLowerCase();
    const namespace = `profile-${BLIZZARD_REGION}`;

    const url = `${API_BASE_URL}/profile/wow/character/${formattedRealm}/${formattedName}/equipment`;
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`Character equipment not found for ${characterName}`);
    }
    return null;
  }
}

/**
 * Get character specialization summary (includes active spec and role)
 * @param {string} realm - Realm name
 * @param {string} characterName - Character name
 * @param {string} namespace - Namespace (optional)
 * @returns {Promise<Object>} Character specialization data with role
 */
export async function getCharacterSpecialization(realm, characterName, namespace = null) {
  try {
    const token = await getAccessToken();
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    const formattedName = characterName.toLowerCase();
    
    if (!namespace) {
      namespace = `profile-${BLIZZARD_REGION}`;
    }

    const url = `${API_BASE_URL}/profile/wow/character/${formattedRealm}/${formattedName}/specializations`;
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`Character specialization not found for ${characterName}`);
    } else {
      console.log(`Error fetching specialization for ${characterName}:`, error.message);
    }
    return null;
  }
}

/**
 * Fetch guild roster from Blizzard API
 * @param {string} guildName - Guild name (e.g., 'Eclipsed')
 * @param {string} realm - Realm name (e.g., 'Stormrage')
 * @param {string} region - Region (e.g., 'us', 'eu')
 * @returns {Promise<Object>} Guild roster data
 */
export async function getGuildRoster(guildName, realm, region = 'us') {
  try {
    const token = await getAccessToken();
    
    // Format realm: lowercase, replace spaces with hyphens
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    // Format guild name: lowercase, replace spaces with hyphens
    const formattedGuildName = guildName.toLowerCase().replace(/\s+/g, '-');
    
    const namespace = `profile-${region}`;
    const url = `https://${region}.api.blizzard.com/data/wow/guild/${formattedRealm}/${formattedGuildName}/roster`;
    
    console.log(`Fetching guild roster: ${guildName} on ${realm}...`);
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        console.log(`Guild ${guildName} on ${realm} not found`);
      } else {
        console.error(`Error fetching guild roster:`, error.response.status, error.response.statusText);
      }
    } else {
      console.error(`Error fetching guild roster:`, error.message);
    }
    return null;
  }
}

/**
 * Get guild information
 */
export async function getGuildInfo(guildName, realm, region = 'us') {
  try {
    const token = await getAccessToken();
    const formattedRealm = realm.toLowerCase().replace(/\s+/g, '-');
    const formattedGuildName = guildName.toLowerCase().replace(/\s+/g, '-');
    const namespace = `profile-${region}`;

    const url = `https://${region}.api.blizzard.com/data/wow/guild/${formattedRealm}/${formattedGuildName}`;
    
    const response = await axios.get(url, {
      params: {
        namespace: namespace,
        locale: 'en_US',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`Guild ${guildName} on ${realm} not found`);
    }
    return null;
  }
}

/**
 * Fetch council/officer members from guild roster using Blizzard API
 * @param {string} guildName - Guild name (e.g., 'Eclipsed')
 * @param {string} realm - Realm name (e.g., 'Stormrage')
 * @param {string} region - Region (default: 'us')
 * @returns {Promise<Array>} Array of council member objects with character data
 */
export async function getGuildCouncilMembers(guildName, realm, region = 'us') {
  try {
    console.log(`Fetching council members from guild ${guildName} on ${realm}...`);
    
    // First, get guild info to understand rank structure
    const guildInfo = await getGuildInfo(guildName, realm, region);
    if (!guildInfo) {
      console.log('Could not fetch guild info');
      return [];
    }
    
    // Get guild roster
    const roster = await getGuildRoster(guildName, realm, region);
    if (!roster || !roster.members) {
      console.log('Could not fetch guild roster');
      return [];
    }
    
    console.log(`Found ${roster.members.length} guild members`);
    
    // Filter for council/officer ranks
    // Typically rank 0 is Guild Master, rank 1 is Officer/Council
    // Lower rank numbers usually indicate higher authority
    const councilMembers = [];
    
    // First, let's see what ranks exist
    const rankCounts = {};
    roster.members.forEach(m => {
      const r = m.rank || 999;
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    });
    console.log('Guild rank distribution:', rankCounts);
    
    for (const member of roster.members) {
      const rank = member.rank ?? 999;
      const character = member.character;
      
      // Include rank 0 (Guild Master) and rank 1 (Officers/Council)
      // Rank 0 = Guild Master, Rank 1 = Council/Officer
      if ((rank === 0 || rank === 1) && character) {
        try {
          // Get detailed character profile
          const characterProfile = await getCharacterProfile(realm, character.name, `profile-${region}`);
          
          if (characterProfile) {
            const councilMember = {
              name: characterProfile.name || character.name,
              // Removed from display: role, guild, rank (user only wants individual player data)
              // But keep rank internally for sorting purposes
              rank: rank, // Store rank for sorting (0 = Guild Master, 1 = Council/Officer)
              class: characterProfile.character_class?.name || '',
              race: characterProfile.race?.name || '',
              level: characterProfile.level?.toString() || '',
              realm: characterProfile.realm?.name || realm,
              region: region.toUpperCase(),
              characterName: characterProfile.name || character.name,
              avatar: '',
              // Initialize Warcraft Logs fields
              highestBossKill: null,
              highestBossKillDifficulty: null,
              highestBossKillUrl: null,
              highestBossKillZone: null,
              overallRanking: null,
              overallRankingMetric: null,
              warcraftLogsAvailable: false,
              warcraftLogsUrl: null
            };
            
            // Get character media for avatar
            const media = await getCharacterMedia(realm, character.name);
            if (media?.assets) {
              const avatarAsset = media.assets.find(asset => asset.key === 'avatar');
              if (avatarAsset) {
                councilMember.avatar = avatarAsset.value;
              }
            }
            
            // Always construct Warcraft Logs profile URL (even if API fails, we can still link to profile)
            // Warcraft Logs URLs use lowercase character names with hyphens, and handle special characters
            const warcraftLogsRealm = realm.toLowerCase().replace(/\s+/g, '-');
            const warcraftLogsRegion = region.toLowerCase() === 'us' ? 'us' : region.toLowerCase();
            const characterName = character.name || councilMember.characterName || councilMember.name || '';
            
            if (characterName && warcraftLogsRealm) {
              // Warcraft Logs uses character names in lowercase
              // Special characters like à, é, etc. should be preserved as-is (URL encoded by browser)
              const characterNameLower = characterName.toLowerCase();
              councilMember.warcraftLogsUrl = `https://www.warcraftlogs.com/character/${warcraftLogsRegion}/${warcraftLogsRealm}/${characterNameLower}`;
              console.log(`    🔗 Created Warcraft Logs URL: ${councilMember.warcraftLogsUrl}`);
            } else {
              console.warn(`    ⚠️  Cannot create Warcraft Logs URL - missing characterName (${characterName}) or realm (${warcraftLogsRealm})`);
            }
            
            // Get Warcraft Logs data (highest boss kill and overall ranking)
            try {
              const warcraftLogsData = await getCharacterRankings(
                character.name,
                realm,
                region.toUpperCase()
              );
              
              if (warcraftLogsData) {
                if (warcraftLogsData.highestBossKill) {
                  councilMember.highestBossKill = warcraftLogsData.highestBossKill.name;
                  councilMember.highestBossKillDifficulty = warcraftLogsData.highestBossKill.difficulty;
                  // Add direct link to the specific fight if available
                  if (warcraftLogsData.highestBossKill.fightUrl) {
                    councilMember.highestBossKillUrl = warcraftLogsData.highestBossKill.fightUrl;
                  }
                  // Add zone/expansion info if available
                  if (warcraftLogsData.highestBossKill.zoneName) {
                    councilMember.highestBossKillZone = warcraftLogsData.highestBossKill.zoneName;
                  }
                }
                if (warcraftLogsData.overallRanking) {
                  councilMember.overallRanking = warcraftLogsData.overallRanking.percentile;
                  councilMember.overallRankingMetric = warcraftLogsData.overallRanking.metric;
                }
                // Use Warcraft Logs profile URL from API if provided (may be more accurate)
                if (warcraftLogsData.warcraftLogsUrl) {
                  councilMember.warcraftLogsUrl = warcraftLogsData.warcraftLogsUrl;
                }
                councilMember.warcraftLogsAvailable = true;
                console.log(`    📊 Warcraft Logs: ${councilMember.highestBossKill || 'No kills'}${councilMember.highestBossKillZone ? ` (${councilMember.highestBossKillZone})` : ''} | Ranking: ${councilMember.overallRanking?.toFixed(1) || 'N/A'}% | URL: ${councilMember.warcraftLogsUrl || 'N/A'}`);
              } else {
                councilMember.warcraftLogsAvailable = false;
                console.log(`    ⚠️  No Warcraft Logs data, but profile URL created: ${councilMember.warcraftLogsUrl || 'N/A'}`);
              }
            } catch (warcraftLogsError) {
              console.error(`    ⚠️  Warcraft Logs error for ${character.name}:`, warcraftLogsError.message);
              console.log(`    ℹ️  Warcraft Logs profile URL still available: ${councilMember.warcraftLogsUrl || 'N/A'}`);
              councilMember.warcraftLogsAvailable = false;
            }
            
            councilMembers.push(councilMember);
            const rankLabel = rank === 0 ? 'Guild Master' : rank === 1 ? 'Council/Officer' : `Rank ${rank}`;
            console.log(`  ✅ Added: ${councilMember.name} (${rankLabel}) - Level ${councilMember.level} ${councilMember.class}`);
          }
          
          // Small delay to respect rate limits (increased for Warcraft Logs API)
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error(`  Error fetching details for ${character.name}:`, error.message);
        }
      }
    }
    
    console.log(`Found ${councilMembers.length} council/officer members`);
    
    // Sort: Guild Master (rank 0) first, then Council members (rank 1) alphabetically
    councilMembers.sort((a, b) => {
      // Sort by rank first (0 = Guild Master comes first, then 1 = Council)
      if (a.rank !== b.rank) {
        return (a.rank ?? 999) - (b.rank ?? 999);
      }
      // If same rank, sort alphabetically by name
      return (a.name || '').localeCompare(b.name || '');
    });
    
    console.log(`Sorted council members: ${councilMembers.map(m => `${m.name} (rank ${m.rank})`).join(', ')}`);
    
    return councilMembers;
    
  } catch (error) {
    console.error('Error fetching guild council members:', error.message);
    return [];
  }
}

/**
 * Fetch Team Lead members from guild roster using Blizzard API
 * Team Leads are typically rank 2 (but can be configured)
 * @param {string} guildName - Guild name (e.g., 'Eclipsed')
 * @param {string} realm - Realm name (e.g., 'Stormrage')
 * @param {string} region - Region (default: 'us')
 * @param {number} teamLeadRank - Rank number for Team Leads (default: 2)
 * @returns {Promise<Array>} Array of team lead member objects with character data
 */
export async function getGuildTeamLeads(guildName, realm, region = 'us', teamLeadRank = 2) {
  try {
    console.log(`Fetching Team Lead members from guild ${guildName} on ${realm} (rank ${teamLeadRank})...`);
    
    // First, get guild info to understand rank structure
    const guildInfo = await getGuildInfo(guildName, realm, region);
    if (!guildInfo) {
      console.log('Could not fetch guild info');
      return [];
    }
    
    // Get guild roster
    const roster = await getGuildRoster(guildName, realm, region);
    if (!roster || !roster.members) {
      console.log('Could not fetch guild roster');
      return [];
    }
    
    console.log(`Found ${roster.members.length} guild members`);
    
    // Filter for Team Lead rank (typically rank 2, but configurable)
    const teamLeads = [];
    
    // First, let's see what ranks exist
    const rankCounts = {};
    roster.members.forEach(m => {
      const r = m.rank || 999;
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    });
    console.log('Guild rank distribution:', rankCounts);
    console.log(`Looking for Team Leads with rank ${teamLeadRank}`);
    
    for (const member of roster.members) {
      const rank = member.rank ?? 999;
      const character = member.character;
      
      // Include Team Lead rank (default: rank 2)
      if (rank === teamLeadRank && character) {
        try {
          // Get detailed character profile
          const characterProfile = await getCharacterProfile(realm, character.name, `profile-${region}`);
          
          if (characterProfile) {
            const teamLeadMember = {
              name: characterProfile.name || character.name,
              rank: rank,
              class: characterProfile.character_class?.name || '',
              race: characterProfile.race?.name || '',
              level: characterProfile.level?.toString() || '',
              realm: characterProfile.realm?.name || realm,
              region: region.toUpperCase(),
              characterName: characterProfile.name || character.name,
              avatar: '',
              // Initialize Warcraft Logs fields
              highestBossKill: null,
              highestBossKillDifficulty: null,
              highestBossKillUrl: null,
              highestBossKillZone: null,
              overallRanking: null,
              overallRankingMetric: null,
              warcraftLogsAvailable: false,
              warcraftLogsUrl: null
            };
            
            // Get character media for avatar
            const media = await getCharacterMedia(realm, character.name);
            if (media?.assets) {
              const avatarAsset = media.assets.find(asset => asset.key === 'avatar');
              if (avatarAsset) {
                teamLeadMember.avatar = avatarAsset.value;
              }
            }
            
            // Always construct Warcraft Logs profile URL
            const warcraftLogsRealm = realm.toLowerCase().replace(/\s+/g, '-');
            const warcraftLogsRegion = region.toLowerCase() === 'us' ? 'us' : region.toLowerCase();
            const characterName = character.name || teamLeadMember.characterName || teamLeadMember.name || '';
            
            if (characterName && warcraftLogsRealm) {
              const characterNameLower = characterName.toLowerCase();
              teamLeadMember.warcraftLogsUrl = `https://www.warcraftlogs.com/character/${warcraftLogsRegion}/${warcraftLogsRealm}/${characterNameLower}`;
              console.log(`    🔗 Created Warcraft Logs URL: ${teamLeadMember.warcraftLogsUrl}`);
            }
            
            // Get Warcraft Logs data (highest boss kill and overall ranking)
            try {
              const warcraftLogsData = await getCharacterRankings(
                character.name,
                realm,
                region.toUpperCase()
              );
              
              if (warcraftLogsData) {
                if (warcraftLogsData.highestBossKill) {
                  teamLeadMember.highestBossKill = warcraftLogsData.highestBossKill.name;
                  teamLeadMember.highestBossKillDifficulty = warcraftLogsData.highestBossKill.difficulty;
                  if (warcraftLogsData.highestBossKill.fightUrl) {
                    teamLeadMember.highestBossKillUrl = warcraftLogsData.highestBossKill.fightUrl;
                  }
                  if (warcraftLogsData.highestBossKill.zoneName) {
                    teamLeadMember.highestBossKillZone = warcraftLogsData.highestBossKill.zoneName;
                  }
                }
                if (warcraftLogsData.overallRanking) {
                  teamLeadMember.overallRanking = warcraftLogsData.overallRanking.percentile;
                  teamLeadMember.overallRankingMetric = warcraftLogsData.overallRanking.metric;
                }
                if (warcraftLogsData.warcraftLogsUrl) {
                  teamLeadMember.warcraftLogsUrl = warcraftLogsData.warcraftLogsUrl;
                }
                teamLeadMember.warcraftLogsAvailable = true;
                console.log(`    📊 Warcraft Logs: ${teamLeadMember.highestBossKill || 'No kills'}${teamLeadMember.highestBossKillZone ? ` (${teamLeadMember.highestBossKillZone})` : ''} | Ranking: ${teamLeadMember.overallRanking?.toFixed(1) || 'N/A'}% | URL: ${teamLeadMember.warcraftLogsUrl || 'N/A'}`);
              } else {
                teamLeadMember.warcraftLogsAvailable = false;
                console.log(`    ⚠️  No Warcraft Logs data, but profile URL created: ${teamLeadMember.warcraftLogsUrl || 'N/A'}`);
              }
            } catch (warcraftLogsError) {
              console.error(`    ⚠️  Warcraft Logs error for ${character.name}:`, warcraftLogsError.message);
              console.log(`    ℹ️  Warcraft Logs profile URL still available: ${teamLeadMember.warcraftLogsUrl || 'N/A'}`);
              teamLeadMember.warcraftLogsAvailable = false;
            }
            
            teamLeads.push(teamLeadMember);
            console.log(`  ✅ Added: ${teamLeadMember.name} (Team Lead, rank ${rank}) - Level ${teamLeadMember.level} ${teamLeadMember.class}`);
          }
          
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (error) {
          console.error(`  Error fetching details for ${character.name}:`, error.message);
        }
      }
    }
    
    console.log(`Found ${teamLeads.length} Team Lead members`);
    
    // Sort alphabetically by name
    teamLeads.sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    });
    
    console.log(`Sorted Team Leads: ${teamLeads.map(m => `${m.name} (rank ${m.rank})`).join(', ')}`);
    
    return teamLeads;
    
  } catch (error) {
    console.error('Error fetching guild Team Lead members:', error.message);
    return [];
  }
}

/**
 * Enhance council member data with Blizzard API information
 * @param {Array} councilMembers - Array of council member objects
 * @returns {Promise<Array>} Enhanced council member array
 */
export async function enhanceCouncilMembersWithAPI(councilMembers) {
  const enhanced = [];
  
  for (const member of councilMembers) {
    const enhancedMember = { ...member };
    
    // Try to get character info from API if we have realm and character name
    if (member.realm && member.characterName) {
      try {
        console.log(`Fetching API data for ${member.name} (${member.characterName} on ${member.realm})...`);
        
        const profile = await getCharacterProfile(member.realm, member.characterName);
        
        if (profile) {
          // Update with API data
          if (profile.name) enhancedMember.characterName = profile.name;
          if (profile.character_class?.name) enhancedMember.class = profile.character_class.name;
          if (profile.race?.name) enhancedMember.race = profile.race.name;
          if (profile.level) enhancedMember.level = profile.level.toString();
          if (profile.realm?.name) enhancedMember.realm = profile.realm.name;
          if (profile.guild?.name) enhancedMember.guild = profile.guild.name;
          if (profile.faction?.name) enhancedMember.faction = profile.faction.name;
          
          // Get character media for avatar
          const media = await getCharacterMedia(member.realm, member.characterName);
          if (media?.assets) {
            // Find the avatar image
            const avatarAsset = media.assets.find(asset => asset.key === 'avatar');
            if (avatarAsset) {
              enhancedMember.avatar = avatarAsset.value;
            }
          }
          
          console.log(`  ✅ Updated: ${profile.name} - Level ${profile.level} ${profile.character_class?.name || ''}`);
        }
      } catch (error) {
        console.error(`  ❌ Error enhancing ${member.name}:`, error.message);
      }
    }
    
    enhanced.push(enhancedMember);
    
    // Small delay between API calls to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return enhanced;
}

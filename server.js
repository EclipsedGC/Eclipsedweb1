import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import { scrapeGoogleSheets } from './scraper/google-sheets-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

app.get('/api/applicants', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'applicants.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ applicants: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guilds', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'guilds.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ guilds: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Council members directly from Blizzard API (replaces Guilds of WoW scraper)
app.get('/api/council', async (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'council.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ council: [], lastUpdated: null, source: 'Blizzard API' });
    }
  } catch (error) {
    console.error('Error reading council data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Council members from Blizzard API
app.post('/api/sync-council', async (req, res) => {
  try {
    const { getGuildCouncilMembers } = await import('./scraper/blizzard-api.js');
    const councilMembers = await getGuildCouncilMembers('Eclipsed', 'Stormrage', 'us');
    
    const data = {
      council: councilMembers,
      lastUpdated: new Date().toISOString(),
      source: 'Blizzard API'
    };
    
    const filePath = join(DATA_DIR, 'council.json');
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Council members synced successfully from Blizzard API', 
      council: councilMembers.length,
      fileCreated: existsSync(filePath)
    });
  } catch (error) {
    console.error('Error in sync-council endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to sync Council members from Blizzard API.'
    });
  }
});

app.get('/api/blogs', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'blogs.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ blogs: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/raid-leaders', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'raid-leaders.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ raidLeaders: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/applicant', (req, res) => {
  try {
    const csvPath = join(__dirname, 'Eclipsed Recruitment - Leadership.csv');
    if (existsSync(csvPath)) {
      const csvContent = readFileSync(csvPath, 'utf8');
      const records = parse(csvContent, {
        columns: false,
        skip_empty_lines: false,
        relax_column_count: true
      });
      res.json({ 
        data: records,
        lastUpdated: new Date().toISOString()
      });
    } else {
      res.json({ data: [], lastUpdated: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const status = {
      applicants: existsSync(join(DATA_DIR, 'applicants.json')),
      guilds: existsSync(join(DATA_DIR, 'guilds.json')),
      blogs: existsSync(join(DATA_DIR, 'blogs.json')),
      raidLeaders: existsSync(join(DATA_DIR, 'raid-leaders.json')),
      council: existsSync(join(DATA_DIR, 'council.json')),
      community: existsSync(join(DATA_DIR, 'community.json')),
      csvFile: existsSync(join(__dirname, 'Eclipsed Recruitment - Leadership.csv'))
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync-sheets', async (req, res) => {
  try {
    const result = await scrapeGoogleSheets();
    res.json({ success: true, message: 'Google Sheets synced successfully', rows: result.rows });
  } catch (error) {
    // Check if it's a 401/403 error and provide detailed instructions
    let statusCode = 500;
    let errorMessage = error.message;
    let helpMessage = 'Failed to sync Google Sheets.';
    
    if (error.message.includes('401') || error.message.includes('403') || error.message.includes('not published')) {
      statusCode = 403;
      helpMessage = `Your Google Sheet needs to be published for public access. 
      
Steps to fix:
1. Open your Google Sheet
2. Click File → Share → Publish to web
3. Select the sheet/tab (gid: 2027893423)
4. Choose "Comma-separated values (.csv)"
5. Click "Publish"
6. Try syncing again`;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      message: helpMessage
    });
  }
});


app.get('/api/community', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'community.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ teamLeads: [], lastUpdated: null, source: 'Blizzard API' });
    }
  } catch (error) {
    console.error('Error reading community data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/guild-teams', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'guild-teams.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ teams: [], lastUpdated: null, source: 'Warcraft Logs Scraper' });
    }
  } catch (error) {
    console.error('Error reading guild teams data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync-guild-teams', async (req, res) => {
  // Respond immediately and process in background
  res.json({ 
    success: true, 
    message: 'Guild teams sync started in background',
    syncing: true
  });
  
  // Process sync in background (non-blocking)
  (async () => {
    try {
      const { scrapeWarcraftLogsGuildTeams } = await import('./scraper/warcraft-logs-guild-teams.js');
      const result = await scrapeWarcraftLogsGuildTeams();
      console.log('Background guild teams sync completed:', {
        teams: result.teams?.length || 0,
        totalPlayers: result.teams?.reduce((sum, team) => sum + (team.roster?.length || 0), 0) || 0
      });
    } catch (error) {
      console.error('Error in background sync-guild-teams:', error);
    }
  })();
});

app.post('/api/sync-community', async (req, res) => {
  try {
    const { getGuildTeamLeads } = await import('./scraper/blizzard-api.js');
    const teamLeads = await getGuildTeamLeads('Eclipsed', 'Stormrage', 'us', 2); // Rank 2 for Team Lead
    
    const data = {
      teamLeads: teamLeads,
      lastUpdated: new Date().toISOString(),
      source: 'Blizzard API'
    };
    
    const filePath = join(DATA_DIR, 'community.json');
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Community Team Leads synced successfully', 
      teamLeads: teamLeads.length,
      fileCreated: existsSync(filePath)
    });
  } catch (error) {
    console.error('Error in sync-community endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to sync Community Team Leads data.'
    });
  }
});

// ==================== TEAM EDITOR ENDPOINTS ====================

// Get all saved teams
app.get('/api/team-editor/teams', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'teams-editor.json');
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.json({ teams: [], lastUpdated: null });
    }
  } catch (error) {
    console.error('Error reading teams-editor data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder teams (MUST be before /teams/:id route to avoid route conflict)
app.post('/api/team-editor/teams/reorder', (req, res) => {
  try {
    const { teamId, direction } = req.body;
    
    if (!teamId || !direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid request: teamId and direction (up/down) required' });
    }
    
    const filePath = join(DATA_DIR, 'teams-editor.json');
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'No teams found' });
    }
    
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!data.teams || !Array.isArray(data.teams) || data.teams.length === 0) {
      return res.status(404).json({ error: 'No teams found' });
    }
    
    const teamIndex = data.teams.findIndex(t => t.teamId === teamId);
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Move team up or down
    if (direction === 'up' && teamIndex > 0) {
      // Swap with previous team
      [data.teams[teamIndex - 1], data.teams[teamIndex]] = [data.teams[teamIndex], data.teams[teamIndex - 1]];
    } else if (direction === 'down' && teamIndex < data.teams.length - 1) {
      // Swap with next team
      [data.teams[teamIndex], data.teams[teamIndex + 1]] = [data.teams[teamIndex + 1], data.teams[teamIndex]];
    } else {
      return res.status(400).json({ error: 'Cannot move team in that direction' });
    }
    
    data.lastUpdated = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Team order updated successfully',
      teams: data.teams
    });
  } catch (error) {
    console.error('Error reordering teams:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to reorder teams'
    });
  }
});

// Get single team by ID
app.get('/api/team-editor/teams/:id', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'teams-editor.json');
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'No teams found' });
    }
    
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const team = data.teams?.find(t => t.teamId === req.params.id);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error reading team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch character data from Warcraft Logs URL
app.post('/api/team-editor/fetch-character', async (req, res) => {
  try {
    const { warcraftLogsUrl } = req.body;
    
    if (!warcraftLogsUrl || !warcraftLogsUrl.includes('warcraftlogs.com/character/')) {
      return res.status(400).json({ error: 'Invalid Warcraft Logs character URL' });
    }
    
    // Parse URL to extract character info
    const match = warcraftLogsUrl.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return res.status(400).json({ error: 'Could not parse Warcraft Logs character URL' });
    }
    
    const [, region, realm, characterName] = match;
    const formattedRealm = realm.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const formattedRegion = region.toUpperCase();
    const formattedName = characterName;
    
    // Fetch character data from Blizzard API
    const { getCharacterProfile, getCharacterMedia } = await import('./scraper/blizzard-api.js');
    const { getCharacterRankings } = await import('./scraper/warcraft-logs-api.js');
    
    const profile = await getCharacterProfile(formattedRealm, formattedName, `profile-${region.toLowerCase()}`);
    const media = profile ? await getCharacterMedia(formattedRealm, formattedName) : null;
    const warcraftLogsData = await getCharacterRankings(formattedName, formattedRealm, formattedRegion);
    
    const character = {
      name: profile?.name || formattedName,
      characterName: formattedName,
      realm: profile?.realm?.name || formattedRealm,
      region: formattedRegion,
      class: profile?.character_class?.name || '',
      race: profile?.race?.name || '',
      level: profile?.level?.toString() || '',
      avatar: media?.assets?.find(a => a.key === 'avatar')?.value || '',
      warcraftLogsUrl: warcraftLogsUrl,
      overallRanking: warcraftLogsData?.overallRanking || null,
      highestBossKill: warcraftLogsData?.highestBossKill || null
    };
    
    res.json({ success: true, character });
  } catch (error) {
    console.error('Error fetching character:', error);
    res.status(500).json({ error: error.message, message: 'Failed to fetch character data' });
  }
});

// Fetch team roster from Warcraft Logs URL
app.post('/api/team-editor/fetch-team-roster', async (req, res) => {
  try {
    const { warcraftLogsUrl } = req.body;
    
    if (!warcraftLogsUrl || !warcraftLogsUrl.includes('warcraftlogs.com')) {
      return res.status(400).json({ error: 'Invalid Warcraft Logs team URL' });
    }
    
    console.log('Fetching team roster from:', warcraftLogsUrl);
    
    // Scrape team data from Warcraft Logs URL
    const { scrapeWarcraftLogsTeamUrl, enhanceRoster } = await import('./scraper/warcraft-logs-team-scraper.js');
    const scrapedData = await scrapeWarcraftLogsTeamUrl(warcraftLogsUrl);
    
    // Enhance roster with Blizzard API data
    console.log('Enhancing roster with Blizzard API...');
    const enhancedRoster = await enhanceRoster(scrapedData.roster);
    
    const team = {
      roster: enhancedRoster,
      progress: scrapedData.progress || {
        bossesKilled: null,
        totalBosses: 8,
        highestDifficulty: null,
        lastLogUpdate: null
      }
    };
    
    res.json({ success: true, team });
  } catch (error) {
    console.error('Error fetching team roster:', error);
    res.status(500).json({ error: error.message, message: 'Failed to fetch team roster' });
  }
});

// Create new team
app.post('/api/team-editor/teams', async (req, res) => {
  try {
    const { teamName, warcraftLogsTeamUrl, raidLeader, raidAssists, roster, progress, borderColor, teamLogo } = req.body;
    
    // Only require teamName - warcraftLogsTeamUrl is optional (can create teams manually)
    if (!teamName) {
      return res.status(400).json({ error: 'Missing required field: teamName' });
    }
    
    // Validate Warcraft Logs URL if provided
    if (warcraftLogsTeamUrl && !warcraftLogsTeamUrl.includes('warcraftlogs.com')) {
      return res.status(400).json({ error: 'Invalid Warcraft Logs URL' });
    }
    
    // If roster is provided from preview, use it; otherwise scrape if URL is provided
    let finalRoster = roster || [];
    let finalProgress = progress || {};
    
    if ((!roster || roster.length === 0) && warcraftLogsTeamUrl) {
      console.log('No roster provided, scraping from Warcraft Logs URL...');
      try {
        const { scrapeWarcraftLogsTeamUrl, enhanceRoster } = await import('./scraper/warcraft-logs-team-scraper.js');
        const scrapedData = await scrapeWarcraftLogsTeamUrl(warcraftLogsTeamUrl);
        finalRoster = await enhanceRoster(scrapedData.roster);
        finalProgress = scrapedData.progress || finalProgress;
      } catch (error) {
        console.error('Error scraping Warcraft Logs URL:', error);
        // Continue with empty roster if scraping fails
        finalRoster = [];
      }
    }
    
    // Generate team ID
    const teamId = randomUUID();
    
    // Create team object (raidLeader can be null/undefined - set in preview editor)
    const team = {
      teamId: teamId,
      teamName: teamName,
      warcraftLogsTeamUrl: warcraftLogsTeamUrl || '',
      raidLeader: raidLeader || null,
      raidAssists: raidAssists || [],
      roster: finalRoster,
      progress: finalProgress,
      borderColor: borderColor || '#6B7280',
      teamLogo: teamLogo || null,
      lastUpdated: new Date().toISOString()
    };
    
    // Save to file
    const filePath = join(DATA_DIR, 'teams-editor.json');
    let teamsData = { teams: [], lastUpdated: null };
    
    if (existsSync(filePath)) {
      teamsData = JSON.parse(readFileSync(filePath, 'utf8'));
    }
    
    teamsData.teams.push(team);
    teamsData.lastUpdated = new Date().toISOString();
    
    writeFileSync(filePath, JSON.stringify(teamsData, null, 2));
    
    res.json({ 
      success: true, 
      team: team,
      message: 'Team created successfully' 
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to create team. Please check the Warcraft Logs URL is valid and accessible.'
    });
  }
});

// Update existing team
app.put('/api/team-editor/teams/:id', async (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'teams-editor.json');
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'No teams found' });
    }
    
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const teamIndex = data.teams?.findIndex(t => t.teamId === req.params.id);
    
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const { teamName, warcraftLogsTeamUrl, raidLeader, raidAssists, roster, progress, borderColor, teamLogo } = req.body;
    
    // If roster is provided from preview, use it; otherwise check if URL changed to re-scrape
    const existingTeam = data.teams[teamIndex];
    let finalRoster = roster || existingTeam.roster;
    let finalProgress = progress || existingTeam.progress;
    
    if (!roster && warcraftLogsTeamUrl && warcraftLogsTeamUrl !== existingTeam.warcraftLogsTeamUrl) {
      if (warcraftLogsTeamUrl && !warcraftLogsTeamUrl.includes('warcraftlogs.com')) {
        return res.status(400).json({ error: 'Invalid Warcraft Logs URL' });
      }
      
      // Re-scrape team data if URL is provided and changed
      if (warcraftLogsTeamUrl) {
        console.log('Re-scraping team data due to URL change...');
        try {
          const { scrapeWarcraftLogsTeamUrl, enhanceRoster } = await import('./scraper/warcraft-logs-team-scraper.js');
          const scrapedData = await scrapeWarcraftLogsTeamUrl(warcraftLogsTeamUrl);
          finalRoster = await enhanceRoster(scrapedData.roster);
          finalProgress = scrapedData.progress || finalProgress;
        } catch (error) {
          console.error('Error scraping Warcraft Logs URL:', error);
          // Continue with existing roster if scraping fails
        }
      }
    }
    
    // Update team
    data.teams[teamIndex] = {
      ...existingTeam,
      teamName: teamName !== undefined ? teamName : existingTeam.teamName,
      warcraftLogsTeamUrl: warcraftLogsTeamUrl !== undefined ? (warcraftLogsTeamUrl || '') : existingTeam.warcraftLogsTeamUrl,
      raidLeader: raidLeader || existingTeam.raidLeader,
      raidAssists: raidAssists !== undefined ? raidAssists : existingTeam.raidAssists || [],
      roster: finalRoster,
      progress: finalProgress,
      borderColor: borderColor !== undefined ? borderColor : existingTeam.borderColor || '#6B7280',
      teamLogo: teamLogo !== undefined ? teamLogo : existingTeam.teamLogo || null,
      lastUpdated: new Date().toISOString()
    };
    
    data.lastUpdated = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      team: data.teams[teamIndex],
      message: 'Team updated successfully' 
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to update team'
    });
  }
});

// Delete team
app.delete('/api/team-editor/teams/:id', (req, res) => {
  try {
    const filePath = join(DATA_DIR, 'teams-editor.json');
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'No teams found' });
    }
    
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const initialLength = data.teams?.length || 0;
    data.teams = data.teams?.filter(t => t.teamId !== req.params.id) || [];
    
    if (data.teams.length === initialLength) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    data.lastUpdated = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    res.json({ 
      success: true, 
      message: 'Team deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to delete team'
    });
  }
});

// Get Team Leads for dropdown
app.get('/api/team-editor/team-leads', async (req, res) => {
  try {
    const { getGuildTeamLeads } = await import('./scraper/blizzard-api.js');
    const teamLeads = await getGuildTeamLeads('Eclipsed', 'Stormrage', 'us', 2);
    
    res.json({ 
      success: true,
      teamLeads: teamLeads,
      count: teamLeads.length
    });
  } catch (error) {
    console.error('Error fetching Team Leads:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      teamLeads: []
    });
  }
});

// Create Dark Matter team (one-time setup)
app.post('/api/team-editor/create-dark-matter', async (req, res) => {
  try {
    const { createDarkMatterTeam } = await import('./scraper/create-dark-matter-team.js');
    const team = await createDarkMatterTeam();
    
    if (team) {
      res.json({
        success: true,
        team: team,
        message: 'Dark Matter team created successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create Dark Matter team',
        message: 'Could not find Ratayu or scrape roster data'
      });
    }
  } catch (error) {
    console.error('Error creating Dark Matter team:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to create Dark Matter team'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


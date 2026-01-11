const API_BASE = 'http://localhost:3001/api';

let currentTab = 'applicants';

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    checkStatus();
    loadApplicants();
    // Auto-sync and load guild teams in left sidebar
    autoSyncGuildTeams();
    
    // Check server status every 30 seconds
    setInterval(checkStatus, 30000);
    
    // Set up periodic auto-sync for council members (every 10 minutes)
    // This ensures data stays fresh even if user keeps tab open
    setInterval(async () => {
        if (currentTab === 'guilds' || currentTab === 'raid-teams') {
            console.log('Periodic auto-sync triggered for council members...');
            try {
                await fetch(`${API_BASE}/sync-council`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                // Reload data after sync
                setTimeout(() => loadGuilds(), 2000);
            } catch (error) {
                console.log('Periodic sync completed (background)');
            }
        }
    }, 600000); // 10 minutes
});

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            currentTab = tabName;
            
            if (tabName === 'applicants') {
                loadApplicants();
            } else if (tabName === 'guilds') {
                // Automatically sync when Raid Teams tab is opened
                autoSyncAndLoadGuilds();
            } else if (tabName === 'raid-teams') {
                // Automatically sync when Raid Teams tab is opened
                autoSyncAndLoadGuilds();
            } else if (tabName === 'blogs') {
                loadBlogs();
            } else if (tabName === 'raid-leaders') {
                loadRaidLeaders();
            } else if (tabName === 'applicant') {
                loadApplicant();
                // Clear sync status when switching to tab
                const syncStatus = document.getElementById('syncStatus');
                if (syncStatus) {
                    syncStatus.innerHTML = '';
                }
            } else if (tabName === 'community') {
                // Auto-sync when Community tab is opened
                autoSyncAndLoadCommunity();
            } else if (tabName === 'team-editor') {
                // Load Team Editor tab
                loadTeamEditor();
            }
        });
    });
}

async function checkStatus() {
    try {
        const response = await fetch(`${API_BASE}/status`);
        const status = await response.json();
        
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        const hasData = status.applicants || status.guilds || status.blogs || status.raidLeaders || status.council || status.community;
        
        if (hasData) {
            statusDot.classList.add('active');
            statusText.textContent = 'Online';
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'No Data';
        }
    } catch (error) {
        console.error('Status check failed:', error);
        document.getElementById('statusDot').classList.remove('active');
        document.getElementById('statusText').textContent = 'Offline';
    }
}

async function loadApplicants() {
    const container = document.getElementById('applicantsList');
    container.innerHTML = '<div class="loading">Loading applicants...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/applicants`);
        const data = await response.json();
        
        if (data.applicants && data.applicants.length > 0) {
            container.innerHTML = data.applicants.map(applicant => `
                <div class="data-card">
                    <h3>${escapeHtml(applicant.name)}</h3>
                    <div class="meta">
                        <span><strong>Class:</strong> ${escapeHtml(applicant.class)}</span>
                        <span><strong>Item Level:</strong> ${escapeHtml(applicant.itemLevel)}</span>
                        <span><strong>IO Score:</strong> ${escapeHtml(applicant.ioScore)}</span>
                        <span><strong>Date:</strong> ${formatDate(applicant.date)}</span>
                    </div>
                    ${applicant.message ? `<div class="description">${escapeHtml(applicant.message)}</div>` : ''}
                </div>
            `).join('');
            
            updateLastUpdated(data.lastUpdated);
        } else {
            container.innerHTML = '<div class="empty">No applicants found</div>';
        }
    } catch (error) {
        console.error('Error loading applicants:', error);
        container.innerHTML = '<div class="empty">Error loading applicants. Make sure the scraper has run.</div>';
    }
}


async function loadGuilds() {
    const container = document.getElementById('guildsList');
    container.innerHTML = '<div class="loading">Loading council members...</div>';
    
    try {
        // Fetch Council members directly from Blizzard API (replaces Guilds of WoW)
        const response = await fetch(`${API_BASE}/council`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const councilMembers = data.council || [];
        
        console.log('Council data loaded:', { 
            councilCount: councilMembers.length,
            lastUpdated: data.lastUpdated,
            source: data.source || 'Blizzard API'
        });
        
        // Ensure we have valid data structure
        if (!Array.isArray(councilMembers)) {
            console.warn('Invalid council data structure, initializing empty array');
            councilMembers = [];
        }
        
        let html = '';
        
        // Display Council members (individual player data only, no guild-related information)
        if (councilMembers.length > 0) {
            html += '<div class="section-divider"><h3 style="color: var(--eclipse-accent); margin-bottom: 15px;">Council</h3></div>';
            html += councilMembers.map(member => {
                if (!member || !member.name) return '';
                
                // Check if overallRanking exists and is a valid number
                const overallRankingRaw = member.overallRanking;
                let overallRankingHtml = '';
                
                // Build overall performance display if data exists
                if (overallRankingRaw != null && overallRankingRaw !== '' && !isNaN(parseFloat(overallRankingRaw))) {
                    const overallRankingValue = parseFloat(overallRankingRaw);
                    const metricText = member.overallRankingMetric ? ` (${escapeHtml(String(member.overallRankingMetric).toUpperCase())})` : '';
                    overallRankingHtml = `<span style="color: #4a90e2;"><strong>Overall Performance:</strong> <span style="color: #69ccf0; font-weight: 600; font-size: 1.1em;">${overallRankingValue.toFixed(1)}%</span>${metricText}</span>`;
                }
                
                return `
                <div class="data-card">
                    <h3>${member.warcraftLogsUrl ? `<a href="${escapeHtml(member.warcraftLogsUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--eclipse-accent); text-decoration: none; font-weight: 600;">${escapeHtml(member.name || 'Unknown')}</a>` : member.name ? escapeHtml(member.name || 'Unknown') : 'Unknown'}</h3>
                    <div class="meta">
                        ${member.class ? (() => { const classSlug = getClassSlug(member.class); return `<span class="class-badge class-${classSlug}"><strong>Class:</strong> <span class="class-name class-${classSlug}">${escapeHtml(member.class)}</span></span>`; })() : ''}
                        ${member.level ? `<span><strong>Level:</strong> ${escapeHtml(member.level)}</span>` : ''}
                        ${member.race ? `<span><strong>Race:</strong> ${escapeHtml(member.race)}</span>` : ''}
                        ${member.realm ? `<span><strong>Realm:</strong> ${escapeHtml(member.realm)}</span>` : ''}
                        ${member.region ? `<span><strong>Region:</strong> ${escapeHtml(member.region)}</span>` : ''}
                        ${overallRankingHtml}
                    </div>
                    ${member.avatar ? `<img src="${escapeHtml(member.avatar)}" alt="${escapeHtml(member.name)}" style="max-width: 100px; border-radius: 4px; margin-top: 10px;" />` : ''}
                </div>
            `;
            }).filter(html => html.length > 0).join('');
        }
        
        if (html && html.trim().length > 0) {
            container.innerHTML = html;
            if (data.lastUpdated) updateLastUpdated(data.lastUpdated);
            console.log('✅ Council members displayed successfully');
            
            // Set up automatic refresh every 5 minutes when on this tab
            if (currentTab === 'guilds' || currentTab === 'raid-teams') {
                if (window.guildsAutoRefreshInterval) {
                    clearInterval(window.guildsAutoRefreshInterval);
                }
                window.guildsAutoRefreshInterval = setInterval(() => {
                    if (currentTab === 'guilds' || currentTab === 'raid-teams') {
                        console.log('Auto-refreshing council data...');
                        loadGuilds();
                    }
                }, 300000); // 5 minutes
            }
        } else {
            container.innerHTML = `<div class="empty">
                <p><strong>No council members found.</strong></p>
                <p>Data syncs automatically from Blizzard API. Click refresh to trigger a sync, or wait for the automatic sync to complete.</p>
            </div>`;
        }
    } catch (error) {
        console.error('Error loading council members:', error);
        container.innerHTML = `<div class="empty">Error loading council members: ${escapeHtml(error.message)}. Make sure the Blizzard API sync has run.</div>`;
    }
}

// Auto-sync and load guilds data (triggers sync in background, then loads data)
async function autoSyncAndLoadGuilds() {
    const container = document.getElementById('guildsList');
    container.innerHTML = '<div class="loading">Syncing council members from Blizzard API...</div>';
    
    try {
        // Load existing data first
        loadGuilds();
        
        // Trigger automatic sync in background (don't wait for it to complete)
        setTimeout(() => {
            fetch(`${API_BASE}/sync-council`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).then(response => response.json())
            .then(result => {
                console.log('Council sync result:', result);
                if (result.success) {
                    // Reload data after sync completes
                    setTimeout(() => {
                        loadGuilds();
                    }, 2000);
                }
            }).catch(err => {
                console.log('Background council sync triggered (may take a moment to complete)');
            });
        }, 500);
    } catch (error) {
        console.error('Error triggering auto-sync:', error);
        // If auto-sync fails, still try to load existing data
        loadGuilds();
    }
    
    // Set up periodic auto-refresh for Raid Teams tab (every 5 minutes)
    if (window.guildsAutoRefreshInterval) {
        clearInterval(window.guildsAutoRefreshInterval);
    }
    window.guildsAutoRefreshInterval = setInterval(() => {
        if (currentTab === 'guilds' || currentTab === 'raid-teams') {
            console.log('Auto-refreshing council data...');
            loadGuilds();
        }
    }, 300000); // 5 minutes
}

// Auto-sync and load community data (triggers sync in background, then loads data)
async function autoSyncAndLoadCommunity() {
    const container = document.getElementById('communityList');
    container.innerHTML = '<div class="loading">Syncing Team Lead members from Blizzard API...</div>';
    
    try {
        // Trigger automatic sync in background
        fetch(`${API_BASE}/sync-community`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => {
            console.log('Background community sync triggered (may take a moment to complete)');
        });
        
        // Wait a moment for sync to start, then load data
        setTimeout(() => {
            loadCommunity();
        }, 1000);
    } catch (error) {
        console.error('Error triggering auto-sync:', error);
        loadCommunity();
    }
}

async function loadCommunity() {
    const container = document.getElementById('communityList');
    container.innerHTML = '<div class="loading">Loading community members...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/community`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        console.log('Community data loaded:', {
            teamLeadsCount: data.teamLeads?.length || 0,
            lastUpdated: data.lastUpdated,
            dataKeys: Object.keys(data || {})
        });
        
        // Ensure we have valid data structure
        if (!data.teamLeads || !Array.isArray(data.teamLeads)) {
            console.warn('Invalid community data structure, initializing empty array');
            data.teamLeads = [];
        }
        
        // Apply filter if one is selected
        const filterValue = document.getElementById('communityFilter')?.value || 'all';
        console.log(`Applying filter: ${filterValue} to ${data.teamLeads.length} Team Leads`);
        let filteredTeamLeads = applyFilterToTeamLeads(data.teamLeads, filterValue);
        console.log(`Filtered result: ${filteredTeamLeads.length} Team Leads after filtering`);
        
        if (filteredTeamLeads.length > 0) {
            let html = '<div class="section-divider"><h3 style="color: var(--eclipse-accent); margin-bottom: 15px;">Team Leads</h3></div>';
            
            html += filteredTeamLeads.map(member => {
                if (!member || !member.name) return '';
                
                // Check if overallRanking exists and is a valid number
                const overallRankingRaw = member.overallRanking;
                let overallRankingHtml = '';
                
                // Build overall performance display if data exists
                if (overallRankingRaw != null && overallRankingRaw !== '' && !isNaN(parseFloat(overallRankingRaw))) {
                    const overallRankingValue = parseFloat(overallRankingRaw);
                    const metricText = member.overallRankingMetric ? ` (${escapeHtml(String(member.overallRankingMetric).toUpperCase())})` : '';
                    overallRankingHtml = `<span style="color: #4a90e2;"><strong>Overall Performance:</strong> <span style="color: #69ccf0; font-weight: 600; font-size: 1.1em;">${overallRankingValue.toFixed(1)}%</span>${metricText}</span>`;
                }
                
                return `
                <div class="data-card">
                    <h3>${member.warcraftLogsUrl ? `<a href="${escapeHtml(member.warcraftLogsUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--eclipse-accent); text-decoration: none; font-weight: 600;">${escapeHtml(member.name || 'Unknown')}</a>` : member.name ? escapeHtml(member.name || 'Unknown') : 'Unknown'}</h3>
                    <div class="meta">
                        ${member.class ? (() => { const classSlug = getClassSlug(member.class); return `<span class="class-badge class-${classSlug}"><strong>Class:</strong> <span class="class-name class-${classSlug}">${escapeHtml(member.class)}</span></span>`; })() : ''}
                        ${member.level ? `<span><strong>Level:</strong> ${escapeHtml(member.level)}</span>` : ''}
                        ${member.race ? `<span><strong>Race:</strong> ${escapeHtml(member.race)}</span>` : ''}
                        ${member.realm ? `<span><strong>Realm:</strong> ${escapeHtml(member.realm)}</span>` : ''}
                        ${member.region ? `<span><strong>Region:</strong> ${escapeHtml(member.region)}</span>` : ''}
                        ${overallRankingHtml}
                    </div>
                    ${member.avatar ? `<img src="${escapeHtml(member.avatar)}" alt="${escapeHtml(member.name)}" style="max-width: 100px; border-radius: 4px; margin-top: 10px;" />` : ''}
                </div>
            `;
            }).filter(html => html.length > 0).join('');
            
            container.innerHTML = html;
            const lastUpdated = data.lastUpdated;
            if (lastUpdated) updateLastUpdated(lastUpdated);
            
            // Show filter count
            const filterInfo = filterValue !== 'all' ? ` (${filteredTeamLeads.length} of ${data.teamLeads.length} shown)` : ` (${data.teamLeads.length} total)`;
            console.log(`✅ Displayed ${filteredTeamLeads.length} Team Leads${filterInfo}`);
        } else {
            // Show helpful message if filter filtered everything out
            if (data.teamLeads && data.teamLeads.length > 0) {
                container.innerHTML = `<div class="empty">
                    <p><strong>No Team Leads match the current filter.</strong></p>
                    <p>Filter: "${filterValue}"</p>
                    <p>Total Team Leads: ${data.teamLeads.length}</p>
                    <p style="margin-top: 10px;">Try selecting "All Players" from the filter dropdown to see all Team Leads.</p>
                </div>`;
            } else {
                container.innerHTML = '<div class="empty">No Team Lead members found. Data syncs automatically from Blizzard API.</div>';
            }
        }
    } catch (error) {
        console.error('Error loading community:', error);
        container.innerHTML = '<div class="empty">Error loading community members. Make sure the scraper has run.</div>';
    }
}

function applyCommunityFilter() {
    loadCommunity(); // Reload with new filter
}

function applyFilterToTeamLeads(teamLeads, filterValue) {
    if (filterValue === 'all') {
        return teamLeads;
    }
    
    return teamLeads.filter(member => {
        const overallRanking = member.overallRanking != null && member.overallRanking !== '' ? parseFloat(member.overallRanking) : null;
        const highestDifficulty = member.highestBossKillDifficulty || '';
        
        switch (filterValue) {
            case '95+':
                return overallRanking != null && overallRanking >= 95;
            case '90-94':
                return overallRanking != null && overallRanking >= 90 && overallRanking < 95;
            case '75-89':
                return overallRanking != null && overallRanking >= 75 && overallRanking < 90;
            case '50-74':
                return overallRanking != null && overallRanking >= 50 && overallRanking < 75;
            case 'mythic':
                return highestDifficulty.toLowerCase().includes('mythic');
            case 'heroic':
                return highestDifficulty.toLowerCase().includes('heroic');
            case 'active':
                // For now, if they have Warcraft Logs data, consider them active
                // You can enhance this later with actual last activity timestamps
                return member.warcraftLogsAvailable === true;
            default:
                return true;
        }
    });
}

// Render sidebar roster with cleaner layout (centered leads, even spacing)
function renderSidebarRoster(raidLeader, raidAssists, tanks, healers, dps, teamBorderColor = '#6B7280') {
    let html = '';
    
    // Helper to render a single player icon
    const renderPlayerIcon = (player) => {
        if (!player || !player.name) return '';
        
        const playerName = player.name || player.characterName || 'Unknown';
        const playerUrl = player.warcraftLogsUrl || '#';
        const avatarUrl = player.avatar || '';
        const playerClass = player.class || '';
        const classSlug = getClassSlug(playerClass);
        const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
        const tooltipText = `${playerName}${playerClass ? ' - ' + playerClass : ''}${player.overallRanking ? ' (' + parseFloat(player.overallRanking).toFixed(1) + '%)' : ''}`;
        const classColor = getClassColor(playerClass);
        const fallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(classColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(classColor)}" stroke-width="2"/></svg>`;
        const borderStyle = classColor && classColor !== '#808080' ? `style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;"` : '';
        
        if (avatarUrl) {
            return `<a href="${escapeHtml(playerUrl)}" target="_blank" rel="noopener noreferrer" class="player-icon-small ${classBorderClass}" title="${escapeHtml(tooltipText)}">
                    <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(playerName)}" class="player-avatar-small ${classBorderClass}" ${borderStyle} onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                    <span class="fallback-avatar-wrapper" style="display:none;">${fallbackSvg}</span>
                    <span class="player-icon-name-small">${escapeHtml(playerName)}</span>
                </a>`;
        } else {
            return `<a href="${escapeHtml(playerUrl)}" target="_blank" rel="noopener noreferrer" class="player-icon-small ${classBorderClass}" title="${escapeHtml(tooltipText)}">
                    ${fallbackSvg}
                    <span class="player-icon-name-small">${escapeHtml(playerName)}</span>
                </a>`;
        }
    };
    
    // Render leads (centered at top)
    if (raidLeader || (raidAssists && raidAssists.length > 0)) {
        html += '<div class="roster-leads-section">';
        html += '<div class="roster-leads-container">';
        
        if (raidLeader) {
            const leaderName = raidLeader.name || raidLeader.characterName || 'Unknown';
            const leaderUrl = raidLeader.warcraftLogsUrl || '#';
            const leaderAvatar = raidLeader.avatar || '';
            const leaderClass = raidLeader.class || '';
            const classSlug = getClassSlug(leaderClass);
            const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
            const leaderColorValue = getClassColor(leaderClass);
            const leaderFallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(leaderColorValue)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(leaderColorValue)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(leaderColorValue)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(leaderColorValue)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(leaderColorValue)}" stroke-width="2"/></svg>`;
            // Use team border color for the outer border (card border), class color for avatar border
            const teamBorderRgba = hexToRgba(teamBorderColor, 0.5);
            const teamBorderRgbaHover = hexToRgba(teamBorderColor, 0.8);
            const teamShadowRgba = hexToRgba(teamBorderColor, 0.2);
            const teamShadowRgbaHover = hexToRgba(teamBorderColor, 0.4);
            const leaderBorderStyle = leaderColorValue && leaderColorValue !== '#808080' ? `style="border: 2px solid ${escapeHtml(leaderColorValue)} !important; border-radius: 50%;"` : '';
            
            const leaderRole = raidLeader.leaderRole || '';
            const leaderTitle = leaderRole ? `${escapeHtml(leaderName)} - Team Lead (${escapeHtml(leaderRole)})` : `${escapeHtml(leaderName)} - Team Lead`;
            
            html += `<a href="${escapeHtml(leaderUrl)}" target="_blank" rel="noopener noreferrer" class="player-icon-small raid-leader-icon ${classBorderClass}" title="${leaderTitle}" style="border-color: ${escapeHtml(teamBorderRgba)} !important; box-shadow: 0 0 10px ${escapeHtml(teamShadowRgba)} !important; transition: border-color 0.3s ease, box-shadow 0.3s ease !important;" onmouseover="this.style.setProperty('border-color', '${escapeHtml(teamBorderRgbaHover)}', 'important'); this.style.setProperty('box-shadow', '0 0 15px ${escapeHtml(teamShadowRgbaHover)}', 'important');" onmouseout="this.style.setProperty('border-color', '${escapeHtml(teamBorderRgba)}', 'important'); this.style.setProperty('box-shadow', '0 0 10px ${escapeHtml(teamShadowRgba)}', 'important');">
                    ${leaderAvatar ? 
                        `<img src="${escapeHtml(leaderAvatar)}" alt="${escapeHtml(leaderName)}" class="player-avatar-small ${classBorderClass}" ${leaderBorderStyle} onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${leaderFallbackSvg}</span>` :
                        leaderFallbackSvg
                    }
                    <span class="player-icon-name-small">${escapeHtml(leaderName)}</span>
                    <span class="role-badge">Team Lead${leaderRole ? ` (${escapeHtml(leaderRole)})` : ''}</span>
                </a>`;
        }
        
        (raidAssists || []).forEach(assist => {
            const assistName = assist.name || assist.characterName || 'Unknown';
            const assistUrl = assist.warcraftLogsUrl || '#';
            const assistAvatar = assist.avatar || '';
            const assistClass = assist.class || '';
            const classSlug = getClassSlug(assistClass);
            const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
            const assistColorValue = getClassColor(assistClass);
            const assistFallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(assistColorValue)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(assistColorValue)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(assistColorValue)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(assistColorValue)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(assistColorValue)}" stroke-width="2"/></svg>`;
            const assistBorderStyle = assistColorValue && assistColorValue !== '#808080' ? `style="border: 2px solid ${escapeHtml(assistColorValue)} !important; border-radius: 50%;"` : '';
            
            const assistRole = assist.assistRole || '';
            const assistTitle = assistRole ? `${escapeHtml(assistName)} - Raid Assist (${escapeHtml(assistRole)})` : `${escapeHtml(assistName)} - Raid Assist`;
            
            html += `<a href="${escapeHtml(assistUrl)}" target="_blank" rel="noopener noreferrer" class="player-icon-small raid-assist-icon ${classBorderClass}" title="${assistTitle}">
                    ${assistAvatar ? 
                        `<img src="${escapeHtml(assistAvatar)}" alt="${escapeHtml(assistName)}" class="player-avatar-small ${classBorderClass}" ${assistBorderStyle} onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${assistFallbackSvg}</span>` :
                        assistFallbackSvg
                    }
                    <span class="player-icon-name-small">${escapeHtml(assistName)}</span>
                    <span class="role-badge">Raid Assist${assistRole ? ` (${escapeHtml(assistRole)})` : ''}</span>
                </a>`;
        });
        
        html += '</div></div>';
    }
    
    // Render role sections with even spacing
    const renderRoleSection = (players, roleName) => {
        if (!players || players.length === 0) return '';
        
        const playersHtml = players.map(renderPlayerIcon).join('');
        
        return `
            <div class="roster-role-section-sidebar">
                <div class="roster-role-header">${roleName}</div>
                <div class="roster-role-grid">
                    ${playersHtml}
                </div>
            </div>
        `;
    };
    
    html += renderRoleSection(tanks, 'Tanks');
    html += renderRoleSection(healers, 'Healers');
    html += renderRoleSection(dps, 'DPS');
    
    return html;
}

// Load and display guild teams in left sidebar (prioritizes Team Editor data)
async function loadGuildTeams() {
    const container = document.getElementById('guildTeamsList');
    if (!container) {
        console.warn('Teams sidebar container not found');
        return;
    }
    
    // Only show loading if container is empty or showing empty state
    if (!container.innerHTML || container.innerHTML.includes('empty') || container.innerHTML.includes('Loading')) {
        container.innerHTML = '<div class="loading">Loading guild teams...</div>';
    }
    
    try {
        // First try to load from Team Editor (priority)
        let response = await fetch(`${API_BASE}/team-editor/teams`);
        let data = null;
        
        if (response.ok) {
            const editorData = await response.json();
            if (editorData.teams && editorData.teams.length > 0) {
                // Use Team Editor data
                data = {
                    teams: editorData.teams,
                    lastUpdated: editorData.lastUpdated,
                    source: 'Team Editor'
                };
                console.log('Loaded teams from Team Editor:', data.teams.length);
            }
        }
        
        // Fallback to guild-teams if no Team Editor data
        if (!data || !data.teams || data.teams.length === 0) {
            response = await fetch(`${API_BASE}/guild-teams`);
            if (response.ok) {
                data = await response.json();
                console.log('Loaded teams from guild-teams fallback:', data.teams?.length || 0);
            }
        }
        
        if (!data || !response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        console.log('Guild teams data loaded:', {
            teamsCount: data.teams?.length || 0,
            lastUpdated: data.lastUpdated,
            source: data.source
        });
        
        // Ensure we have valid data structure
        if (!data.teams || !Array.isArray(data.teams)) {
            console.warn('Invalid teams data structure, initializing empty array');
            data.teams = [];
        }
        
        if (data.teams.length > 0) {
            // Teams from Team Editor are already in the correct order (order in JSON file = display order)
            // No sorting needed - the order in the saved teams list is the order for the sidebar
            const sortedTeams = data.teams;
            
            let html = '';
            
            sortedTeams.forEach((team, teamIndex) => {
                if (!team || !team.roster || !Array.isArray(team.roster)) return;
                
                const teamId = team.teamId || `team-${teamIndex}`;
                const progress = team.progress || {};
                const bossesKilled = progress.bossesKilled !== null && progress.bossesKilled !== undefined ? progress.bossesKilled : null;
                const totalBosses = progress.totalBosses || 8;
                const highestDifficulty = progress.highestDifficulty || '';
                
                const progressInfo = bossesKilled !== null ? 
                    `${bossesKilled}/${totalBosses} Bosses${highestDifficulty ? ` - ${highestDifficulty}` : ''}` : 
                    `${team.roster.length} Players`;
                
                // Organize roster by role (excludes raid leader and assists - they're shown separately)
                const { teamLead, tanks, healers, dps } = organizeRosterByRole(team.roster, team.raidLeader, team.raidAssists || []);
                
                // Use renderSidebarRoster for cleaner layout
                const rosterHtml = renderSidebarRoster(team.raidLeader, team.raidAssists || [], tanks, healers, dps, team.borderColor || '#6B7280');
                
                html += `
                    <div class="sidebar-team-box" data-team-id="${teamId}" data-team-index="${teamIndex}">
                        <div class="team-box-content" style="border-color: ${escapeHtml(team.borderColor || '#6B7280')};">
                            <div class="team-box-header" onclick="toggleTeamBox('${teamId}')">
                                <div class="team-box-title">
                                    <h4>
                                        ${team.teamLogo ? `<img src="${escapeHtml(team.teamLogo)}" alt="${escapeHtml(team.teamName || 'Team')} Logo" class="team-logo-sidebar" />` : ''}
                                        <a href="${escapeHtml(team.warcraftLogsTeamUrl || '#')}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" class="team-name-link">
                                            ${escapeHtml(team.teamName || 'Team')}
                                        </a>
                                    </h4>
                                    <span class="team-box-progress">${progressInfo}</span>
                                </div>
                                <span class="team-box-toggle" id="toggle-${teamId}">▼</span>
                            </div>
                            <div class="team-box-roster collapsed" id="roster-${teamId}" style="display: none;">
                                ${rosterHtml}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html || '<div class="empty">No teams found</div>';
            console.log(`✅ Displayed ${sortedTeams.length} teams in sidebar`);
        } else {
            container.innerHTML = '<div class="empty" style="padding: 20px; text-align: center; color: var(--eclipse-text-dim);">No teams found. Click refresh to sync from Warcraft Logs.</div>';
        }
    } catch (error) {
        console.error('Error loading guild teams:', error);
        container.innerHTML = '<div class="empty" style="padding: 20px; text-align: center; color: var(--eclipse-text-dim);">Error loading guild teams. Make sure the scraper has run.</div>';
    }
}

// Toggle team box roster visibility
function toggleTeamBox(teamId) {
    const roster = document.getElementById(`roster-${teamId}`);
    const toggle = document.getElementById(`toggle-${teamId}`);
    
    if (!roster || !toggle) return;
    
    if (roster.classList.contains('collapsed')) {
        roster.classList.remove('collapsed');
        roster.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        roster.classList.add('collapsed');
        roster.style.display = 'none';
        toggle.textContent = '▼';
    }
}

// Move team up in order
// Move saved team up in order (in Team Editor)
async function moveSavedTeamUp(teamId) {
    try {
        const response = await fetch(`${API_BASE}/team-editor/teams/reorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ teamId, direction: 'up' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        // Reload saved teams list and sidebar to reflect new order
        await loadSavedTeams();
        await loadGuildTeams();
    } catch (error) {
        console.error('Error moving team up:', error);
        alert(`Error reordering team: ${error.message}`);
    }
}

// Move saved team down in order (in Team Editor)
async function moveSavedTeamDown(teamId) {
    try {
        const response = await fetch(`${API_BASE}/team-editor/teams/reorder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ teamId, direction: 'down' })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        // Reload saved teams list and sidebar to reflect new order
        await loadSavedTeams();
        await loadGuildTeams();
    } catch (error) {
        console.error('Error moving team down:', error);
        alert(`Error reordering team: ${error.message}`);
    }
}

// Load guild teams - shows cached data first, then syncs in background
async function autoSyncGuildTeams() {
    // Load existing cached data immediately (non-blocking)
    console.log('Loading cached guild teams data immediately...');
    loadGuildTeams();
    
    // Then trigger sync in background without blocking (after a short delay)
    setTimeout(() => {
        console.log('Triggering background sync for guild teams (non-blocking)...');
        fetch(`${API_BASE}/sync-guild-teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(response => response.json())
        .then(result => {
            console.log('Guild teams sync initiated:', result.message);
            // Wait for sync to complete, then reload (check after reasonable delay)
            // Sync happens in background, so we poll after ~10 seconds
            setTimeout(() => {
                console.log('Checking for updated guild teams data...');
                loadGuildTeams(); // Reload to show updated data
            }, 10000); // Wait 10 seconds for sync to complete
        }).catch(err => {
            console.log('Background guild teams sync failed (using cached data):', err.message);
            // Keep existing data, don't reload
        });
    }, 1000); // 1 second delay to let initial load finish
}

async function loadBlogs() {
    const container = document.getElementById('blogsList');
    container.innerHTML = '<div class="loading">Loading blogs...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/blogs`);
        const data = await response.json();
        
        if (data.blogs && data.blogs.length > 0) {
            container.innerHTML = data.blogs.map(blog => `
                <div class="data-card">
                    <h3>${escapeHtml(blog.title)}</h3>
                    <div class="meta">
                        <span><strong>Source:</strong> ${escapeHtml(blog.source)}</span>
                        <span><strong>Author:</strong> ${escapeHtml(blog.author)}</span>
                        <span><strong>Date:</strong> ${formatDate(blog.date)}</span>
                    </div>
                    ${blog.excerpt ? `<div class="description">${escapeHtml(blog.excerpt)}</div>` : ''}
                    ${blog.url ? `<a href="${blog.url}" target="_blank">Read more →</a>` : ''}
                </div>
            `).join('');
            
            updateLastUpdated(data.lastUpdated);
        } else {
            container.innerHTML = '<div class="empty">No blog posts found</div>';
        }
    } catch (error) {
        console.error('Error loading blogs:', error);
        container.innerHTML = '<div class="empty">Error loading blogs. Make sure the scraper has run.</div>';
    }
}

async function loadRaidLeaders() {
    const container = document.getElementById('raidLeadersList');
    container.innerHTML = '<div class="loading">Loading raid leaders...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/raid-leaders`);
        const data = await response.json();
        
        if (data.raidLeaders && data.raidLeaders.length > 0) {
            container.innerHTML = data.raidLeaders.map(leader => `
                <div class="data-card">
                    <h3>${escapeHtml(leader.name)}</h3>
                    <div class="meta">
                        ${leader.class ? `<span><strong>Class:</strong> ${escapeHtml(leader.class)}</span>` : ''}
                        ${leader.role ? `<span><strong>Role:</strong> ${escapeHtml(leader.role)}</span>` : ''}
                        ${leader.itemLevel ? `<span><strong>Item Level:</strong> ${escapeHtml(leader.itemLevel)}</span>` : ''}
                        ${leader.ioScore ? `<span><strong>IO Score:</strong> ${escapeHtml(leader.ioScore)}</span>` : ''}
                        ${leader.realm ? `<span><strong>Realm:</strong> ${escapeHtml(leader.realm)}</span>` : ''}
                        ${leader.date ? `<span><strong>Date:</strong> ${formatDate(leader.date)}</span>` : ''}
                    </div>
                    ${leader.description ? `<div class="description">${escapeHtml(leader.description)}</div>` : ''}
                    ${leader.url ? `<a href="${leader.url}" target="_blank">View Profile →</a>` : ''}
                </div>
            `).join('');
            
            updateLastUpdated(data.lastUpdated);
        } else {
            container.innerHTML = '<div class="empty">No raid leaders found</div>';
        }
    } catch (error) {
        console.error('Error loading raid leaders:', error);
        container.innerHTML = '<div class="empty">Error loading raid leaders. Make sure the scraper has run.</div>';
    }
}

function updateLastUpdated(timestamp) {
    if (timestamp) {
        const date = new Date(timestamp);
        document.getElementById('lastUpdated').textContent = date.toLocaleString();
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
        return dateString;
    }
}

function getClassSlug(className) {
    if (!className) return '';
    const classLower = className.toLowerCase().trim();
    
    // Map class names to CSS class slugs (check compound names first to avoid partial matches)
    if (classLower.includes('death knight') || classLower === 'dk') return 'dk';
    if (classLower.includes('demon hunter') || classLower === 'dh') return 'dh';
    if (classLower.includes('druid')) return 'druid';
    if (classLower.includes('warrior')) return 'warrior';
    if (classLower.includes('paladin')) return 'paladin';
    if (classLower.includes('hunter') && !classLower.includes('demon')) return 'hunter';
    if (classLower.includes('rogue')) return 'rogue';
    if (classLower.includes('priest')) return 'priest';
    if (classLower.includes('shaman')) return 'shaman';
    if (classLower.includes('mage')) return 'mage';
    if (classLower.includes('warlock')) return 'warlock';
    if (classLower.includes('monk')) return 'monk';
    if (classLower.includes('evoker')) return 'evoker';
    
    return '';
}

// Get class color hex code
function getClassColor(className) {
    const classSlug = getClassSlug(className);
    const colorMap = {
        'druid': '#ff7d0a',
        'warrior': '#c79c6e',
        'paladin': '#f58cba',
        'hunter': '#abd473',
        'rogue': '#fff569',
        'priest': '#ffffff',
        'shaman': '#0070de',
        'mage': '#69ccf0',
        'warlock': '#9482c9',
        'monk': '#00ff96',
        'dh': '#a330c9',
        'evoker': '#33937f',
        'dk': '#c41f3b'
    };
    return colorMap[classSlug] || '#808080';
}

// Determine player role based on stored role field or infer from class
function getPlayerRole(player) {
    // If player has a role field (set from Blizzard API specialization), use it
    if (player.role) {
        const roleLower = player.role.toLowerCase();
        if (roleLower.includes('tank')) return 'Tank';
        if (roleLower.includes('heal')) return 'Healer';
        return 'DPS';
    }
    
    // Fallback: Infer from class (simplified - default to DPS as most common)
    // Note: This is a fallback. The role should ideally come from Blizzard API specialization data
    return 'DPS';
}

// Note: Fallback avatars are now created inline in renderPlayerIcon function
// This function is kept for reference but not used directly

// Organize roster by role: Team Lead first, then Tanks, Healers, DPS
// Note: Raid assists are handled separately and not included in the roster
function organizeRosterByRole(roster, raidLeader, raidAssists = []) {
    const teamLead = [];
    const tanks = [];
    const healers = [];
    const dps = [];
    
    // Identify raid leader first (check multiple name fields for matching)
    const raidLeaderName = raidLeader ? (raidLeader.characterName || raidLeader.name || '').toLowerCase().trim() : '';
    const raidLeaderNameAlt = raidLeader ? (raidLeader.name || raidLeader.characterName || '').toLowerCase().trim() : '';
    
    // Create set of raid assist names for quick lookup
    const assistNames = new Set();
    (raidAssists || []).forEach(assist => {
        const assistName = (assist.characterName || assist.name || '').toLowerCase().trim();
        const assistNameAlt = (assist.name || assist.characterName || '').toLowerCase().trim();
        if (assistName) assistNames.add(assistName);
        if (assistNameAlt) assistNames.add(assistNameAlt);
    });
    
    roster.forEach(player => {
        const playerName = (player.characterName || player.name || '').toLowerCase().trim();
        const playerNameAlt = (player.name || player.characterName || '').toLowerCase().trim();
        
        // Check if this player is the raid leader (compare both name variations)
        const isLeader = raidLeaderName && (playerName === raidLeaderName || playerName === raidLeaderNameAlt || playerNameAlt === raidLeaderName || playerNameAlt === raidLeaderNameAlt);
        
        // Check if this player is a raid assist
        const isAssist = assistNames.has(playerName) || assistNames.has(playerNameAlt);
        
        if (isLeader || isAssist) {
            // Don't add to roster sections - they're displayed separately as leads/assists
            return;
        }
        
        // Only add to role sections if not the raid leader or assist
        const role = getPlayerRole(player);
        if (role === 'Tank') {
            tanks.push({ ...player, role: 'Tank' });
        } else if (role === 'Healer') {
            healers.push({ ...player, role: 'Healer' });
        } else {
            dps.push({ ...player, role: 'DPS' });
        }
    });
    
    // Sort each category alphabetically
    const sortByName = (a, b) => (a.characterName || a.name || '').localeCompare(b.characterName || b.name || '');
    tanks.sort(sortByName);
    healers.sort(sortByName);
    dps.sort(sortByName);
    
    return { teamLead, tanks, healers, dps };
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== TEAM EDITOR FUNCTIONS ====================

let editingTeamId = null;
let currentTeamPreviewData = null; // Store team data during preview/edit

// Load Team Editor tab content
async function loadTeamEditor() {
    // Reset form state
    resetTeamForm();
    // Load saved teams
    await loadSavedTeams();
}

// Parse Warcraft Logs character URL to extract character info
function parseWarcraftLogsCharacterUrl(url) {
    if (!url || !url.includes('warcraftlogs.com/character/')) {
        return null;
    }
    
    try {
        const match = url.match(/\/character\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
        if (!match) return null;
        
        const [, region, realm, characterName] = match;
        return {
            region: region.toUpperCase(),
            realm: realm.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            characterName: characterName,
            warcraftLogsUrl: url
        };
    } catch (error) {
        console.error('Error parsing Warcraft Logs URL:', error);
        return null;
    }
}

// Fetch character data from Warcraft Logs URL via backend
async function fetchCharacterFromWarcraftLogs(warcraftLogsUrl) {
    try {
        const response = await fetch(`${API_BASE}/team-editor/fetch-character`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ warcraftLogsUrl })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching character from Warcraft Logs:', error);
        throw error;
    }
}

// Add player to roster from Warcraft Logs URL
async function addPlayerFromUrl() {
    const urlInput = document.getElementById('addPlayerUrl');
    if (!urlInput) return;
    
    const warcraftLogsUrl = urlInput.value.trim();
    if (!warcraftLogsUrl) {
        alert('Please enter a Warcraft Logs character URL');
        return;
    }
    
    if (!warcraftLogsUrl.includes('warcraftlogs.com/character/')) {
        alert('Please enter a valid Warcraft Logs character URL (e.g., https://www.warcraftlogs.com/character/us/stormrage/playername)');
        return;
    }
    
    // Check if we have preview data
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.roster) {
        alert('Please fetch team data first before adding players');
        return;
    }
    
    // Check if player already exists in roster
    const urlMatch = warcraftLogsUrl.match(/\/character\/[^\/]+\/[^\/]+\/([^\/]+)/);
    const characterNameFromUrl = urlMatch ? urlMatch[1].toLowerCase().trim() : '';
    
    const existingPlayer = window.currentTeamPreviewData.roster.find(p => {
        const playerName = (p.name || p.characterName || '').toLowerCase().trim();
        const playerUrl = (p.warcraftLogsUrl || '').toLowerCase().trim();
        return playerName === characterNameFromUrl || playerUrl === warcraftLogsUrl.toLowerCase();
    });
    
    if (existingPlayer) {
        alert(`Player "${existingPlayer.name || existingPlayer.characterName}" is already in the roster`);
        urlInput.value = '';
        return;
    }
    
    // Find the add button (it's in the same row as the input)
    const addBtn = urlInput.closest('.add-player-input-row')?.querySelector('button');
    const originalBtnText = addBtn?.textContent || 'Add Player';
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.textContent = 'Adding...';
    }
    
    try {
        // Fetch character data
        console.log('Fetching player data from:', warcraftLogsUrl);
        const result = await fetchCharacterFromWarcraftLogs(warcraftLogsUrl);
        
        if (!result.success || !result.character) {
            throw new Error('Failed to fetch character data');
        }
        
        const character = result.character;
        
        // Add player with default role (will be DPS if no role specified)
        const newPlayer = {
            ...character,
            role: character.role || 'DPS', // Default to DPS if no role
            _role: character.role || 'DPS'
        };
        
        // Add to roster
        window.currentTeamPreviewData.roster.push(newPlayer);
        
        console.log('Player added to roster:', newPlayer.name || newPlayer.characterName);
        
        // Clear input
        urlInput.value = '';
        
        // Re-render preview to show new player
        renderTeamPreview(window.currentTeamPreviewData);
        
    } catch (error) {
        console.error('Error adding player:', error);
        alert(`Error adding player: ${error.message}\n\nPlease make sure the Warcraft Logs URL is correct.`);
    } finally {
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = originalBtnText;
        }
    }
}

// Add a Raid Assist input field
let raidAssistCount = 0;
function addRaidAssist() {
    const container = document.getElementById('raidAssistsContainer');
    if (!container) return;
    
    const assistId = `raidAssist_${raidAssistCount++}`;
    const assistDiv = document.createElement('div');
    assistDiv.className = 'raid-assist-input';
    assistDiv.innerHTML = `
        <input type="url" id="${assistId}" name="${assistId}" placeholder="https://www.warcraftlogs.com/character/us/stormrage/assistname" style="flex: 1; margin-right: 8px;" />
        <button type="button" class="btn-secondary" onclick="removeRaidAssist('${assistId}')">Remove</button>
    `;
    container.appendChild(assistDiv);
}

// Remove a Raid Assist input field
function removeRaidAssist(assistId) {
    const input = document.getElementById(assistId);
    if (input) {
        input.closest('.raid-assist-input').remove();
    }
}

// Fetch team roster from Warcraft Logs URL
async function fetchTeamRoster() {
    const warcraftLogsUrl = document.getElementById('warcraftLogsUrl').value.trim();
    if (!warcraftLogsUrl) {
        alert('Please enter a Warcraft Logs Team URL first');
        return;
    }
    
    const fetchBtn = document.getElementById('fetchRosterBtn');
    const originalText = fetchBtn ? fetchBtn.textContent : 'Fetch Team Data';
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Fetching...';
    }
    
    try {
        console.log('Fetching team roster from:', warcraftLogsUrl);
        const response = await fetch(`${API_BASE}/team-editor/fetch-team-roster`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ warcraftLogsUrl })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Team roster fetched:', result);
        
        // Store the fetched team data in window object for global access
        window.currentTeamPreviewData = result.team || {};
        
        // Store the Warcraft Logs URL so we can detect if it changes
        window.currentTeamPreviewData.warcraftLogsTeamUrl = warcraftLogsUrl;
        
        // Ensure roster exists
        if (!window.currentTeamPreviewData.roster) {
            window.currentTeamPreviewData.roster = [];
        }
        
        console.log('Roster size:', window.currentTeamPreviewData.roster?.length || 0);
        
        // Show preview button if team name is filled (will also show when team name is entered later)
        const teamName = document.getElementById('teamName')?.value.trim();
        const previewBtn = document.getElementById('previewTeamBtn');
        if (previewBtn && teamName) {
            previewBtn.style.display = 'inline-block';
        }
        
        // Add event listener to team name input to show preview button when team name is entered
        const teamNameInput = document.getElementById('teamName');
        if (teamNameInput && !teamNameInput.hasAttribute('data-listener-added')) {
            teamNameInput.setAttribute('data-listener-added', 'true');
            teamNameInput.addEventListener('input', function() {
                const name = this.value.trim();
                const url = document.getElementById('warcraftLogsUrl')?.value.trim();
                if (previewBtn && name && url && window.currentTeamPreviewData?.roster?.length > 0) {
                    previewBtn.style.display = 'inline-block';
                } else if (previewBtn && !name) {
                    previewBtn.style.display = 'none';
                }
            });
        }
        
        const rosterCount = window.currentTeamPreviewData.roster?.length || 0;
        if (rosterCount === 0) {
            const message = teamName 
                ? `Team roster fetched, but no players were found. You can still click "Preview & Edit Team" to add players manually.`
                : `Team roster fetched, but no players were found. Enter a Team Name, then click "Preview & Edit Team" to add players manually.`;
            alert(message);
        } else {
            const message = teamName 
                ? `Team roster fetched successfully! Found ${rosterCount} players. Click "Preview & Edit Team" to set raid leader and assists.`
                : `Team roster fetched successfully! Found ${rosterCount} players. Enter a Team Name, then click "Preview & Edit Team" to set raid leader and assists.`;
            alert(message);
        }
        
        // Show preview button if team name is filled (already declared above)
        if (previewBtn && teamName) {
            previewBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Error fetching team roster:', error);
        alert(`Error fetching team roster: ${error.message}`);
        window.currentTeamPreviewData = null;
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = originalText;
        }
    }
}

// Create team with no URL (empty roster)
function createTeamWithNoUrl() {
    const teamName = document.getElementById('teamName').value.trim();
    if (!teamName) {
        alert('Please enter a Team Name first');
        return;
    }
    
    // Initialize empty team data
    window.currentTeamPreviewData = {
        teamName: teamName,
        warcraftLogsTeamUrl: '',
        roster: [],
        raidLeader: null,
        raidAssists: [],
        progress: {
            bossesKilled: null,
            totalBosses: 8,
            highestDifficulty: null
        },
        borderColor: '#6B7280'
    };
    
    // Show preview button
    const previewBtn = document.getElementById('previewTeamBtn');
    if (previewBtn) {
        previewBtn.style.display = 'inline-block';
    }
    
    alert('Empty team created! Click "Preview & Edit Team" to add players manually using Warcraft Logs URLs.');
}

// Load saved teams list
async function loadSavedTeams() {
    const container = document.getElementById('savedTeamsList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading saved teams...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/team-editor/teams`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const teams = data.teams || [];
        
        if (teams.length === 0) {
            container.innerHTML = '<div class="empty">No teams saved yet. Create your first team above!</div>';
            return;
        }
        
        let html = '';
        teams.forEach((team, index) => {
            const rosterSize = team.roster?.length || 0;
            const progress = team.progress || {};
            const bossesInfo = progress.bossesKilled !== null && progress.totalBosses ? 
                `${progress.bossesKilled}/${progress.totalBosses}` : 'N/A';
            const difficulty = progress.highestDifficulty || 'Unknown';
            const teamId = team.teamId || `team-${index}`;
            
            html += `
                <div class="saved-team-card" data-team-id="${teamId}">
                    <div class="team-reorder-controls-saved">
                        <button class="reorder-btn-saved reorder-up" onclick="moveSavedTeamUp('${teamId}')" ${index === 0 ? 'disabled' : ''} title="Move up">▲</button>
                        <button class="reorder-btn-saved reorder-down" onclick="moveSavedTeamDown('${teamId}')" ${index === teams.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
                    </div>
                    <div class="saved-team-card-info">
                        <h4>${escapeHtml(team.teamName)}</h4>
                        <p>${rosterSize} players | ${bossesInfo} bosses (${difficulty}) | Leader: ${escapeHtml(team.raidLeader?.name || 'N/A')}</p>
                    </div>
                    <div class="saved-team-card-actions">
                        <button class="btn-edit" onclick="editTeam('${teamId}')">Edit</button>
                        <button class="btn-delete" onclick="deleteTeam('${teamId}')">Delete</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading saved teams:', error);
        container.innerHTML = `<div class="empty">Error loading teams: ${escapeHtml(error.message)}</div>`;
    }
}

// Show team preview/edit section
async function showTeamPreview() {
    const teamName = document.getElementById('teamName').value.trim();
    const warcraftLogsUrl = document.getElementById('warcraftLogsUrl').value.trim();
    
    // Only require team name (Warcraft Logs URL is optional now)
    if (!teamName) {
        alert('Please fill in Team Name');
        return;
    }
    
    // Show loading state
    const previewBtn = document.getElementById('previewTeamBtn');
    if (previewBtn) {
        previewBtn.disabled = true;
        previewBtn.textContent = 'Loading...';
    }
    
    try {
        // Check if we need to fetch the roster (either not fetched yet, or URL changed)
        const existingUrl = window.currentTeamPreviewData?.warcraftLogsTeamUrl || '';
        const shouldFetch = !window.currentTeamPreviewData || 
                           !window.currentTeamPreviewData.roster || 
                           window.currentTeamPreviewData.roster.length === 0 ||
                           existingUrl !== warcraftLogsUrl;
        
        if (shouldFetch && warcraftLogsUrl) {
            console.log('Fetching roster from Warcraft Logs...', { existingUrl, newUrl: warcraftLogsUrl });
            await fetchTeamRoster();
            
            // Initialize roster if fetch failed (allow empty roster)
            if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.roster) {
                window.currentTeamPreviewData = {
                    roster: [],
                    warcraftLogsTeamUrl: warcraftLogsUrl,
                    raidLeader: null,
                    raidAssists: []
                };
            }
            
            console.log(`Roster fetched: ${window.currentTeamPreviewData.roster.length} players`);
        } else if (shouldFetch && !warcraftLogsUrl) {
            // No URL provided, initialize empty roster
            window.currentTeamPreviewData = {
                roster: [],
                warcraftLogsTeamUrl: '',
                raidLeader: null,
                raidAssists: []
            };
            console.log('Initialized empty roster (no URL provided)');
        } else {
            console.log(`Using existing roster: ${window.currentTeamPreviewData.roster.length} players`);
        }
        
        // Prepare team data for preview - use existing raid leader and assists if set, otherwise empty
        const previewData = {
            teamName: teamName,
            warcraftLogsTeamUrl: warcraftLogsUrl,
            raidLeader: window.currentTeamPreviewData?.raidLeader || null,
            raidAssists: window.currentTeamPreviewData?.raidAssists || [],
            roster: window.currentTeamPreviewData.roster || [],
            progress: window.currentTeamPreviewData.progress || {
                bossesKilled: null,
                totalBosses: 8,
                highestDifficulty: null
            },
            borderColor: window.currentTeamPreviewData.borderColor || '#6B7280' // Default gray
        };
        
        console.log('Preview data prepared:', {
            teamName: previewData.teamName,
            rosterSize: previewData.roster.length,
            hasLeader: !!previewData.raidLeader,
            assistsCount: previewData.raidAssists.length
        });
        
        // Store for saving later
        window.currentTeamPreviewData = previewData;
        
        // Render preview section
        renderTeamPreview(previewData);
        
        // Show preview section and hide form
        document.getElementById('teamPreviewSection').style.display = 'block';
        document.getElementById('saveTeamBtn').style.display = 'inline-block';
        if (previewBtn) {
            previewBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error showing team preview:', error);
        alert(`Error loading team preview: ${error.message}`);
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview & Edit Team';
        }
    } finally {
        if (previewBtn && !previewBtn.style.display || previewBtn.style.display !== 'none') {
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview & Edit Team';
        }
    }
}

// Render team preview/edit interface
function renderTeamPreview(teamData) {
    const container = document.getElementById('teamPreviewContent');
    if (!container) return;
    
    const roster = teamData.roster || [];
    const progress = teamData.progress || {};
    
    // Empty roster is now allowed - show the editor so users can add players manually
    
    // Filter out raid leader and assists from roster (they're shown separately in leads section)
    const raidLeaderName = teamData.raidLeader ? (teamData.raidLeader.characterName || teamData.raidLeader.name || '').toLowerCase().trim() : '';
    const assistNames = new Set();
    (teamData.raidAssists || []).forEach(assist => {
        const assistName = (assist.characterName || assist.name || '').toLowerCase().trim();
        if (assistName) assistNames.add(assistName);
    });
    
    const filteredRoster = roster.filter(player => {
        const playerName = (player.characterName || player.name || '').toLowerCase().trim();
        const isLeader = raidLeaderName && playerName === raidLeaderName;
        const isAssist = assistNames.has(playerName);
        const isTeamAssist = (player.role || '').toLowerCase() === 'team assist';
        return !isLeader && !isAssist && !isTeamAssist;
    });
    
    // Organize filtered roster by role for editing (excluding Team Assist role)
    const tanks = filteredRoster.filter(p => {
        const role = (p.role || p._role || '').toLowerCase();
        return role === 'tank';
    }).map(p => ({...p, _role: 'Tank'}));
    const healers = filteredRoster.filter(p => {
        const role = (p.role || p._role || '').toLowerCase();
        return role === 'healer';
    }).map(p => ({...p, _role: 'Healer'}));
    const dps = filteredRoster.filter(p => {
        const role = (p.role || p._role || '').toLowerCase();
        return role !== 'tank' && role !== 'healer' && role !== 'team assist';
    }).map(p => ({...p, _role: 'DPS'}));
    
    // Render preview HTML
    let html = `
        <div class="team-preview-container">
            <div class="team-preview-header">
                <h4>${escapeHtml(teamData.teamName)}</h4>
                <div class="team-preview-meta">
                    <div class="meta-group">
                        <label>Border Color:</label>
                        <input type="color" id="teamBorderColor" value="${teamData.borderColor || '#6B7280'}" onchange="updateTeamBorderColor(this.value)" />
                        <span id="borderColorHex">${teamData.borderColor || '#6B7280'}</span>
                    </div>
                    <div class="meta-group">
                        <label>Warcraft Logs Team URL:</label>
                        <input type="url" id="teamWarcraftLogsUrl" value="${escapeHtml(teamData.warcraftLogsTeamUrl || '')}" placeholder="https://www.warcraftlogs.com/guild/id/694290" style="width: 100%; padding: 8px 12px; background: var(--eclipse-surface); border: 1px solid var(--eclipse-border); border-radius: 6px; color: var(--eclipse-text); font-size: 0.9rem;" onchange="updateTeamWarcraftLogsUrl(this.value)" />
                        <small style="color: var(--eclipse-text-dim); display: block; margin-top: 5px;">Optional - can be added or updated later</small>
                    </div>
                    <div class="meta-group">
                        <label>Team Logo:</label>
                        <div class="team-logo-upload-group">
                            <input type="file" id="teamLogoUpload" style="display: none;" />
                            <button type="button" class="btn-secondary" id="chooseImageBtn">Choose Image</button>
                            ${teamData.teamLogo ? `<button type="button" class="btn-secondary" id="removeLogoBtn" style="margin-left: 8px;">Remove</button>` : ''}
                        </div>
                        ${teamData.teamLogo ? `
                        <div class="logo-sidebar-preview">
                            <div class="logo-sidebar-preview-label">Preview: Sidebar Display</div>
                            <div class="logo-sidebar-preview-box">
                                <div class="logo-sidebar-preview-content">
                                    <img src="${escapeHtml(teamData.teamLogo)}" alt="Team Logo" class="logo-sidebar-preview-logo" />
                                    <span class="logo-sidebar-preview-name">${escapeHtml(teamData.teamName || 'Team Name')}</span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="team-progression-edit">
                <h5>Team Progression</h5>
                <div class="progression-inputs">
                    <label>Bosses Killed:</label>
                    <input type="number" id="bossesKilled" min="0" max="20" value="${progress.bossesKilled !== null && progress.bossesKilled !== undefined ? progress.bossesKilled : ''}" placeholder="0" onchange="updateTeamProgression()" oninput="updateTeamProgression()" />
                    <span>/</span>
                    <input type="number" id="totalBosses" min="1" max="20" value="${progress.totalBosses || 8}" placeholder="8" onchange="updateTeamProgression()" oninput="updateTeamProgression()" />
                    <label style="margin-left: 15px;">Difficulty:</label>
                    <select id="highestDifficulty" onchange="updateTeamProgression()">
                        <option value="Normal" ${progress.highestDifficulty === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="Heroic" ${progress.highestDifficulty === 'Heroic' ? 'selected' : ''}>Heroic</option>
                        <option value="Mythic" ${progress.highestDifficulty === 'Mythic' ? 'selected' : ''}>Mythic</option>
                    </select>
                </div>
            </div>
            
            <!-- Team Lead Selection -->
            <div class="team-lead-selection">
                <h5>Team Lead</h5>
                <div class="team-lead-selection-group">
                    <div class="team-lead-select-group">
                        <label for="teamLeadSelect">Select Team Lead:</label>
                        <select id="teamLeadSelect" class="team-lead-select" onchange="handleTeamLeadChange(this.value)">
                            <option value="">-- Select Team Lead --</option>
                            ${roster.map(p => {
                                const playerName = p.name || p.characterName || 'Unknown';
                                const currentLeaderName = teamData.raidLeader ? (teamData.raidLeader.name || teamData.raidLeader.characterName || '').toLowerCase().trim() : '';
                                const playerNameLower = playerName.toLowerCase().trim();
                                const isSelected = currentLeaderName === playerNameLower;
                                return `<option value="${escapeHtml(playerName)}" ${isSelected ? 'selected' : ''}>${escapeHtml(playerName)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="team-lead-role-group">
                        <label for="teamLeadRoleSelect">Team Lead Role:</label>
                        <select id="teamLeadRoleSelect" class="role-select" onchange="handleTeamLeadRoleChange(this.value)">
                            <option value="" ${!teamData.raidLeader?.leaderRole ? 'selected' : ''}>None</option>
                            <option value="Tank" ${teamData.raidLeader?.leaderRole === 'Tank' ? 'selected' : ''}>Tank</option>
                            <option value="Healer" ${teamData.raidLeader?.leaderRole === 'Healer' ? 'selected' : ''}>Healer</option>
                            <option value="DPS" ${teamData.raidLeader?.leaderRole === 'DPS' ? 'selected' : ''}>DPS</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Team Assists Selection -->
            <div class="team-lead-selection" style="margin-top: 20px;">
                <h5>Team Assists</h5>
                <div id="teamAssistsContainer">
                    ${(teamData.raidAssists || []).map((assist, idx) => {
                        const assistName = assist.name || assist.characterName || '';
                        const assistRole = assist.assistRole || '';
                        return `
                            <div class="team-lead-selection-group" style="margin-bottom: 10px;" data-assist-index="${idx}">
                                <div class="team-lead-select-group">
                                    <label>Select Team Assist:</label>
                                    <select class="team-lead-select team-assist-select" onchange="handleTeamAssistChange(${idx}, this.value)">
                                        <option value="">-- Select Team Assist --</option>
                                        ${roster.map(p => {
                                            const playerName = p.name || p.characterName || 'Unknown';
                                            const currentAssistName = assistName.toLowerCase().trim();
                                            const playerNameLower = playerName.toLowerCase().trim();
                                            const isSelected = currentAssistName === playerNameLower;
                                            // Don't allow selecting the team lead or other assists
                                            const isLeader = teamData.raidLeader && (teamData.raidLeader.name || teamData.raidLeader.characterName || '').toLowerCase().trim() === playerNameLower;
                                            const isOtherAssist = (teamData.raidAssists || []).some((a, i) => i !== idx && ((a.name || a.characterName || '').toLowerCase().trim() === playerNameLower));
                                            if (isLeader || (isOtherAssist && !isSelected)) return '';
                                            return `<option value="${escapeHtml(playerName)}" ${isSelected ? 'selected' : ''}>${escapeHtml(playerName)}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                                <div class="team-lead-role-group">
                                    <label>Assist Role:</label>
                                    <select class="role-select team-assist-role-select" onchange="handleTeamAssistRoleChange(${idx}, this.value)">
                                        <option value="" ${!assistRole ? 'selected' : ''}>None</option>
                                        <option value="Tank" ${assistRole === 'Tank' ? 'selected' : ''}>Tank</option>
                                        <option value="Healer" ${assistRole === 'Healer' ? 'selected' : ''}>Healer</option>
                                        <option value="DPS" ${assistRole === 'DPS' ? 'selected' : ''}>DPS</option>
                                    </select>
                                </div>
                                <button type="button" class="btn-secondary" onclick="removeTeamAssistFromSelection(${idx})" style="margin-left: 10px; padding: 5px 10px;">Remove</button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <button type="button" class="btn-secondary" onclick="addNewTeamAssist()" style="margin-top: 10px; padding: 8px 16px;">
                    + New Assist
                </button>
            </div>
            
            <div class="team-roster-edit">
                <h5>Roster Organization</h5>
                
                <!-- Add Player Manually -->
                <div class="add-player-section">
                    <div class="add-player-input-group">
                        <label for="addPlayerUrl">Add Player (Warcraft Logs URL):</label>
                        <div class="add-player-input-row">
                            <input type="url" id="addPlayerUrl" placeholder="https://www.warcraftlogs.com/character/us/stormrage/playername" class="add-player-input" />
                            <button type="button" class="btn-secondary" onclick="addPlayerFromUrl()">Add Player</button>
                        </div>
                        <small style="color: var(--eclipse-text-dim); display: block; margin-top: 5px;">Add a player that may have been missed during data fetching</small>
                    </div>
                </div>
                
                <p class="help-text">Drag players between roles or use the role dropdown to organize your roster</p>
                
                <!-- Team Lead & Assists Display -->
                <div class="roster-role-section" style="margin-bottom: 20px;">
                    <h6>Team Lead & Assists</h6>
                    <div class="roster-leads-display" id="rosterLeadsDisplay">
                        ${renderTeamLeadAndAssistsDisplay(teamData.raidLeader, teamData.raidAssists || [], teamData.borderColor || '#6B7280')}
                    </div>
                </div>
                
                <!-- Tanks -->
                <div class="roster-role-section">
                    <h6>Tanks (${tanks.length})</h6>
                    <div class="roster-role-list" id="rosterTanks" data-role="Tank">
                        ${renderRosterRoleList(tanks)}
                    </div>
                </div>
                
                <!-- Healers -->
                <div class="roster-role-section">
                    <h6>Healers (${healers.length})</h6>
                    <div class="roster-role-list" id="rosterHealers" data-role="Healer">
                        ${renderRosterRoleList(healers)}
                    </div>
                </div>
                
                <!-- DPS -->
                <div class="roster-role-section">
                    <h6>DPS (${dps.length})</h6>
                    <div class="roster-role-list" id="rosterDPS" data-role="DPS">
                        ${renderRosterRoleList(dps)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Attach event listeners for file upload
    const fileInput = document.getElementById('teamLogoUpload');
    const chooseImageBtn = document.getElementById('chooseImageBtn');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    
    if (fileInput && chooseImageBtn) {
        // Remove any existing event listeners by cloning the button
        const newChooseBtn = chooseImageBtn.cloneNode(true);
        chooseImageBtn.parentNode.replaceChild(newChooseBtn, chooseImageBtn);
        
        // Attach event listener to the new button
        newChooseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (fileInput) {
                fileInput.click();
            }
        });
        
        // Attach change listener to file input
        fileInput.addEventListener('change', function(event) {
            if (event.target.files && event.target.files.length > 0) {
                handleTeamLogoUpload(event);
            }
        });
    }
    
    if (removeLogoBtn) {
        removeLogoBtn.addEventListener('click', function() {
            removeTeamLogo();
        });
    }
}

// Render team leads (leader + assists) - display only (selection is done in dedicated section above)
function renderRosterLeads(raidLeader, raidAssists, allRosterPlayers = []) {
    let html = '';
    
    if (raidLeader) {
        const leaderName = raidLeader.name || raidLeader.characterName || 'Unknown';
        const leaderClass = raidLeader.class || '';
        const leaderRole = raidLeader.leaderRole || ''; // Role for team lead (Tank/Healer/DPS)
        const avatarUrl = raidLeader.avatar || '';
        const classSlug = getClassSlug(leaderClass);
        const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
        const classColor = getClassColor(leaderClass);
        const fallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(classColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(classColor)}" stroke-width="2"/></svg>`;
        const warcraftLogsUrl = raidLeader.warcraftLogsUrl || '';
        const leaderDisplay = warcraftLogsUrl ? 
            `<a href="${escapeHtml(warcraftLogsUrl)}" target="_blank" class="player-name-link">${escapeHtml(leaderName)}</a>` :
            `<span>${escapeHtml(leaderName)}</span>`;
        
        html += `
            <div class="roster-lead-item" data-type="leader">
                <div class="lead-info">
                    <div class="player-avatar-container">
                        ${avatarUrl ? 
                            `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(leaderName)}" class="player-avatar-small ${classBorderClass}" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${fallbackSvg}</span>` :
                            fallbackSvg
                        }
                        <button class="player-delete-btn" onclick="removeTeamLeadFromPreview(event)" title="Remove Team Lead">×</button>
                    </div>
                    <div class="lead-name-info">
                        <span class="lead-badge">Team Lead</span>
                        ${leaderDisplay}
                        ${leaderClass ? `<span class="lead-class">${escapeHtml(leaderClass)}</span>` : ''}
                        ${leaderRole ? `<span class="role-badge">${escapeHtml(leaderRole)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    (raidAssists || []).forEach((assist, idx) => {
        const assistName = assist.name || assist.characterName || 'Unknown';
        const assistClass = assist.class || '';
        const assistAvatarUrl = assist.avatar || '';
        const assistClassSlug = getClassSlug(assistClass);
        const assistClassBorderClass = assistClassSlug ? `class-border-${assistClassSlug}` : '';
        const assistClassColor = getClassColor(assistClass);
        const assistFallbackSvg = `<svg class="fallback-avatar ${assistClassBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(assistClassColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(assistClassColor)}" stroke-width="2"/></svg>`;
        const assistWarcraftLogsUrl = assist.warcraftLogsUrl || '';
        const assistDisplay = assistWarcraftLogsUrl ? 
            `<a href="${escapeHtml(assistWarcraftLogsUrl)}" target="_blank" class="player-name-link">${escapeHtml(assistName)}</a>` :
            `<span>${escapeHtml(assistName)}</span>`;
        html += `
            <div class="roster-lead-item" data-type="assist" data-index="${idx}">
                <div class="lead-info">
                    <div class="player-avatar-container">
                        ${assistAvatarUrl ? 
                            `<img src="${escapeHtml(assistAvatarUrl)}" alt="${escapeHtml(assistName)}" class="player-avatar-small ${assistClassBorderClass}" style="border: 2px solid ${escapeHtml(assistClassColor)} !important; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${assistFallbackSvg}</span>` :
                            assistFallbackSvg
                        }
                        <button class="player-delete-btn" onclick="removeRaidAssistFromPreview('${escapeHtml(assistName)}', event)" title="Remove Raid Assist">×</button>
                    </div>
                    <div class="lead-name-info">
                        <span class="lead-badge">Raid Assist</span>
                        ${assistDisplay}
                        ${assistClass ? `<span class="lead-class">${escapeHtml(assistClass)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    return html || '<div class="empty-role">No leaders assigned</div>';
}

// Render Team Lead and Assists display cards (horizontal layout for Roster Organization)
function renderTeamLeadAndAssistsDisplay(raidLeader, raidAssists, teamBorderColor = '#6B7280') {
    let html = '<div class="roster-leads-display-container">';
    
    // Render Team Lead card
    if (raidLeader) {
        const leaderName = raidLeader.name || raidLeader.characterName || 'Unknown';
        const leaderClass = raidLeader.class || '';
        const leaderRole = raidLeader.leaderRole || '';
        const avatarUrl = raidLeader.avatar || '';
        const classSlug = getClassSlug(leaderClass);
        const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
        const classColor = getClassColor(leaderClass);
        const fallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(classColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(classColor)}" stroke-width="2"/></svg>`;
        const warcraftLogsUrl = raidLeader.warcraftLogsUrl || '';
        const leaderDisplay = warcraftLogsUrl ? 
            `<a href="${escapeHtml(warcraftLogsUrl)}" target="_blank" class="player-name-link">${escapeHtml(leaderName)}</a>` :
            `<span>${escapeHtml(leaderName)}</span>`;
        
        // Convert hex color to rgba for border styling
        const borderRgba = hexToRgba(teamBorderColor, 0.5);
        const borderRgbaHover = hexToRgba(teamBorderColor, 0.8);
        const shadowRgba = hexToRgba(teamBorderColor, 0.2);
        const shadowRgbaHover = hexToRgba(teamBorderColor, 0.4);
        
        html += `
            <div class="team-lead-display-card" style="border-color: ${escapeHtml(borderRgba)} !important; box-shadow: 0 0 10px ${escapeHtml(shadowRgba)} !important;" onmouseover="this.style.borderColor='${escapeHtml(borderRgbaHover)}'; this.style.boxShadow='0 0 15px ${escapeHtml(shadowRgbaHover)}';" onmouseout="this.style.borderColor='${escapeHtml(borderRgba)}'; this.style.boxShadow='0 0 10px ${escapeHtml(shadowRgba)}';">
                <div class="player-avatar-container-display">
                    ${avatarUrl ? 
                        `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(leaderName)}" class="player-avatar-display ${classBorderClass}" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${fallbackSvg}</span>` :
                        fallbackSvg
                    }
                </div>
                <div class="display-card-info">
                    <span class="lead-badge-display">Team Lead</span>
                    <div class="player-name-display">${leaderDisplay}</div>
                    ${leaderClass ? `<span class="player-class-display">${escapeHtml(leaderClass)}</span>` : ''}
                    ${leaderRole ? `<span class="role-badge-display">${escapeHtml(leaderRole)}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    // Render Assist cards
    (raidAssists || []).forEach((assist, idx) => {
        const assistName = assist.name || assist.characterName || 'Unknown';
        const assistClass = assist.class || '';
        const assistRole = assist.assistRole || '';
        const assistAvatarUrl = assist.avatar || '';
        const assistClassSlug = getClassSlug(assistClass);
        const assistClassBorderClass = assistClassSlug ? `class-border-${assistClassSlug}` : '';
        const assistClassColor = getClassColor(assistClass);
        const assistFallbackSvg = `<svg class="fallback-avatar ${assistClassBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(assistClassColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(assistClassColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(assistClassColor)}" stroke-width="2"/></svg>`;
        const assistWarcraftLogsUrl = assist.warcraftLogsUrl || '';
        const assistDisplay = assistWarcraftLogsUrl ? 
            `<a href="${escapeHtml(assistWarcraftLogsUrl)}" target="_blank" class="player-name-link">${escapeHtml(assistName)}</a>` :
            `<span>${escapeHtml(assistName)}</span>`;
        
        html += `
            <div class="team-assist-display-card">
                <div class="player-avatar-container-display">
                    ${assistAvatarUrl ? 
                        `<img src="${escapeHtml(assistAvatarUrl)}" alt="${escapeHtml(assistName)}" class="player-avatar-display ${assistClassBorderClass}" style="border: 2px solid ${escapeHtml(assistClassColor)} !important; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${assistFallbackSvg}</span>` :
                        assistFallbackSvg
                    }
                </div>
                <div class="display-card-info">
                    <span class="assist-badge-display">Raid Assist</span>
                    <div class="player-name-display">${assistDisplay}</div>
                    ${assistClass ? `<span class="player-class-display">${escapeHtml(assistClass)}</span>` : ''}
                    ${assistRole ? `<span class="role-badge-display">${escapeHtml(assistRole)}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // If no lead and no assists, show placeholder
    if (!raidLeader && (!raidAssists || raidAssists.length === 0)) {
        return '<div class="empty-role">No Team Lead or Assists assigned</div>';
    }
    
    return html;
}

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha = 1) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Render roster role list (Tanks/Healers/DPS) with role assignment
function renderRosterRoleList(players) {
    if (!players || players.length === 0) {
        return '<div class="empty-role">No players in this role</div>';
    }
    
    return players.map((player, idx) => {
        const playerName = player.name || player.characterName || 'Unknown';
        const playerClass = player.class || '';
        const classSlug = getClassSlug(playerClass);
        const classBorderClass = classSlug ? `class-border-${classSlug}` : '';
        const avatarUrl = player.avatar || '';
        const classColor = getClassColor(playerClass);
        const fallbackSvg = `<svg class="fallback-avatar ${classBorderClass}" width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="border: 2px solid ${escapeHtml(classColor)} !important; border-radius: 50%;"><circle cx="20" cy="20" r="20" fill="${escapeHtml(classColor)}" fill-opacity="0.2"/><circle cx="20" cy="14" r="7" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><path d="M 12 28 Q 12 24, 20 24 Q 28 24, 28 28 L 28 32 Q 28 36, 20 36 Q 12 36, 12 32 Z" fill="${escapeHtml(classColor)}" fill-opacity="0.4"/><circle cx="20" cy="20" r="19" fill="none" stroke="${escapeHtml(classColor)}" stroke-width="2"/></svg>`;
        
        return `
            <div class="roster-player-item" data-player-index="${idx}" data-character-name="${escapeHtml(playerName)}">
                <div class="player-avatar-container">
                    ${avatarUrl ? 
                        `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(playerName)}" class="player-avatar-small ${classBorderClass}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="fallback-avatar-wrapper" style="display:none;">${fallbackSvg}</span>` :
                        fallbackSvg
                    }
                    <button class="player-delete-btn" onclick="deletePlayerFromTeam('${escapeHtml(playerName)}', event)" title="Remove player from team">×</button>
                </div>
                <span class="player-name-small">${escapeHtml(playerName)}</span>
                ${playerClass ? `<span class="player-class-small">${escapeHtml(playerClass)}</span>` : ''}
                <select class="role-select" onchange="handleRoleChangeInPreview('${escapeHtml(playerName)}', this.value)">
                    <option value="Tank" ${(player._role || player.role || '').toLowerCase() === 'tank' ? 'selected' : ''}>Tank</option>
                    <option value="Healer" ${(player._role || player.role || '').toLowerCase() === 'healer' ? 'selected' : ''}>Healer</option>
                    <option value="DPS" ${(player._role || player.role || '').toLowerCase() !== 'tank' && (player._role || player.role || '').toLowerCase() !== 'healer' ? 'selected' : ''}>DPS</option>
                </select>
            </div>
        `;
    }).join('');
}

// Update player role in preview (handles role changes and re-renders)
function handleRoleChangeInPreview(characterName, newRole) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.roster) return;
    
    const player = window.currentTeamPreviewData.roster.find(p => 
        (p.name || p.characterName) === characterName
    );
    
    if (!player) return;
    
    // If role is "Team Assist", add to raid assists and remove from roster sections
    if (newRole === 'Team Assist') {
        player.role = newRole;
        player._role = newRole;
        
        // Check if already in raid assists
        const assistNames = (window.currentTeamPreviewData.raidAssists || []).map(a => 
            (a.name || a.characterName || '').toLowerCase().trim()
        );
        const playerNameLower = (player.name || player.characterName || '').toLowerCase().trim();
        
        if (!assistNames.includes(playerNameLower)) {
            // Add to raid assists
            if (!window.currentTeamPreviewData.raidAssists) {
                window.currentTeamPreviewData.raidAssists = [];
            }
            window.currentTeamPreviewData.raidAssists.push(player);
        }
    } else {
        // Regular role (Tank/Healer/DPS) - remove from raid assists if present
        player.role = newRole;
        player._role = newRole;
        
        const playerNameLower = (player.name || player.characterName || '').toLowerCase().trim();
        if (window.currentTeamPreviewData.raidAssists) {
            window.currentTeamPreviewData.raidAssists = window.currentTeamPreviewData.raidAssists.filter(a => {
                const assistName = (a.name || a.characterName || '').toLowerCase().trim();
                return assistName !== playerNameLower;
            });
        }
    }
    
    // Re-render preview to reorganize players by role
    renderTeamPreview(window.currentTeamPreviewData);
}

// Handle team lead change
function handleTeamLeadChange(newLeaderName) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.roster) return;
    
    // Handle empty selection - clear team lead
    if (!newLeaderName || newLeaderName.trim() === '' || newLeaderName === '-- Select Team Lead --') {
        window.currentTeamPreviewData.raidLeader = null;
        // Reset role dropdown
        const roleSelect = document.getElementById('teamLeadRoleSelect');
        if (roleSelect) {
            roleSelect.value = '';
        }
        renderTeamPreview(window.currentTeamPreviewData);
        return;
    }
    
    // Find the new leader in the roster
    const newLeader = window.currentTeamPreviewData.roster.find(p => {
        const pName = (p.name || p.characterName || '').toLowerCase().trim();
        const newName = (newLeaderName || '').toLowerCase().trim();
        return pName === newName;
    });
    
    if (!newLeader) {
        alert(`Player "${newLeaderName}" not found in roster`);
        // Reset dropdown to current leader or empty
        const select = document.getElementById('teamLeadSelect');
        if (select && window.currentTeamPreviewData.raidLeader) {
            const currentLeaderName = window.currentTeamPreviewData.raidLeader.name || window.currentTeamPreviewData.raidLeader.characterName || '';
            select.value = currentLeaderName;
        } else if (select) {
            select.value = '';
        }
        return;
    }
    
    // Get current leader
    const currentLeader = window.currentTeamPreviewData.raidLeader;
    const newLeaderNameLower = (newLeaderName || '').toLowerCase().trim();
    
    // If the new leader is currently a raid assist, remove from assists
    if (window.currentTeamPreviewData.raidAssists) {
        window.currentTeamPreviewData.raidAssists = window.currentTeamPreviewData.raidAssists.filter(a => {
            const assistName = (a.name || a.characterName || '').toLowerCase().trim();
            return assistName !== newLeaderNameLower;
        });
    }
    
    // Get current leader's role to preserve it, or use new leader's existing role
    const currentLeaderRole = currentLeader?.leaderRole || '';
    const newLeaderRole = newLeader.leaderRole || currentLeaderRole || '';
    
    // Set new leader
    window.currentTeamPreviewData.raidLeader = {
        ...newLeader,
        leaderRole: newLeaderRole
    };
    
    // Update role dropdown to show new leader's role
    const roleSelect = document.getElementById('teamLeadRoleSelect');
    if (roleSelect) {
        roleSelect.value = window.currentTeamPreviewData.raidLeader.leaderRole || '';
    }
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Handle team lead role change
function handleTeamLeadRoleChange(newRole) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.raidLeader) return;
    
    // Update team lead's role
    window.currentTeamPreviewData.raidLeader.leaderRole = newRole || '';
    
    // Re-render to show updated role
    renderTeamPreview(window.currentTeamPreviewData);
}

// Remove raid assist from preview
// Remove team lead from preview
function removeTeamLeadFromPreview(event) {
    // Prevent event bubbling
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.raidLeader) return;
    
    const leaderName = window.currentTeamPreviewData.raidLeader.name || window.currentTeamPreviewData.raidLeader.characterName || 'Unknown';
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to remove "${leaderName}" as Team Lead?`)) {
        return;
    }
    
    // Clear team lead
    window.currentTeamPreviewData.raidLeader = null;
    
    // Update dropdowns
    const teamLeadSelect = document.getElementById('teamLeadSelect');
    if (teamLeadSelect) {
        teamLeadSelect.value = '';
    }
    const teamLeadRoleSelect = document.getElementById('teamLeadRoleSelect');
    if (teamLeadRoleSelect) {
        teamLeadRoleSelect.value = '';
    }
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Add new team assist (creates empty assist entry)
function addNewTeamAssist() {
    if (!window.currentTeamPreviewData) return;
    
    if (!window.currentTeamPreviewData.raidAssists) {
        window.currentTeamPreviewData.raidAssists = [];
    }
    
    // Add empty assist object
    window.currentTeamPreviewData.raidAssists.push({
        name: '',
        characterName: '',
        assistRole: ''
    });
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Handle team assist selection change
function handleTeamAssistChange(assistIndex, selectedPlayerName) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.raidAssists) return;
    
    if (assistIndex < 0 || assistIndex >= window.currentTeamPreviewData.raidAssists.length) return;
    
    // Handle empty selection - remove the assist entry
    if (!selectedPlayerName || selectedPlayerName.trim() === '' || selectedPlayerName === '-- Select Team Assist --') {
        window.currentTeamPreviewData.raidAssists.splice(assistIndex, 1);
        renderTeamPreview(window.currentTeamPreviewData);
        return;
    }
    
    // Find the player in roster
    const selectedPlayer = window.currentTeamPreviewData.roster.find(p => {
        const pName = (p.name || p.characterName || '').toLowerCase().trim();
        const selectedName = (selectedPlayerName || '').toLowerCase().trim();
        return pName === selectedName;
    });
    
    if (!selectedPlayer) {
        alert(`Player "${selectedPlayerName}" not found in roster`);
        return;
    }
    
    // Clone the player data for the assist
    const assistData = {
        ...selectedPlayer,
        assistRole: window.currentTeamPreviewData.raidAssists[assistIndex]?.assistRole || ''
    };
    
    // Update the assist at this index
    window.currentTeamPreviewData.raidAssists[assistIndex] = assistData;
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Handle team assist role change
function handleTeamAssistRoleChange(assistIndex, newRole) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.raidAssists) return;
    
    if (assistIndex < 0 || assistIndex >= window.currentTeamPreviewData.raidAssists.length) return;
    
    // Update the assist's role
    if (window.currentTeamPreviewData.raidAssists[assistIndex]) {
        window.currentTeamPreviewData.raidAssists[assistIndex].assistRole = newRole || '';
    }
    
    // Re-render to update display
    renderTeamPreview(window.currentTeamPreviewData);
}

// Remove team assist from selection
function removeTeamAssistFromSelection(assistIndex) {
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.raidAssists) return;
    
    if (assistIndex < 0 || assistIndex >= window.currentTeamPreviewData.raidAssists.length) return;
    
    const assist = window.currentTeamPreviewData.raidAssists[assistIndex];
    const assistName = (assist.name || assist.characterName || 'Unknown');
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to remove "${assistName}" as Team Assist?`)) {
        return;
    }
    
    // Remove from raid assists
    window.currentTeamPreviewData.raidAssists.splice(assistIndex, 1);
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Delete player from team (removes from roster entirely)
function deletePlayerFromTeam(playerName, event) {
    // Prevent event bubbling to avoid triggering other handlers
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    if (!window.currentTeamPreviewData || !window.currentTeamPreviewData.roster) return;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to remove "${playerName}" from this team?`)) {
        return;
    }
    
    const playerNameLower = (playerName || '').toLowerCase().trim();
    
    // Remove from roster
    window.currentTeamPreviewData.roster = window.currentTeamPreviewData.roster.filter(p => {
        const pName = (p.name || p.characterName || '').toLowerCase().trim();
        return pName !== playerNameLower;
    });
    
    // Remove from raid assists if present
    if (window.currentTeamPreviewData.raidAssists) {
        window.currentTeamPreviewData.raidAssists = window.currentTeamPreviewData.raidAssists.filter(a => {
            const aName = (a.name || a.characterName || '').toLowerCase().trim();
            return aName !== playerNameLower;
        });
    }
    
    // If this was the team lead, clear it
    const currentLeaderName = window.currentTeamPreviewData.raidLeader ? 
        (window.currentTeamPreviewData.raidLeader.name || window.currentTeamPreviewData.raidLeader.characterName || '').toLowerCase().trim() : '';
    
    if (currentLeaderName === playerNameLower) {
        window.currentTeamPreviewData.raidLeader = null;
        alert('The team lead has been removed. Please select a new team lead before saving.');
    }
    
    // Re-render preview
    renderTeamPreview(window.currentTeamPreviewData);
}

// Update player role in preview (called from role dropdown) - alias for backwards compatibility
function updatePlayerRole(characterName, newRole) {
    handleRoleChangeInPreview(characterName, newRole);
}

// Update team border color
function updateTeamBorderColor(color) {
    if (window.currentTeamPreviewData) {
        window.currentTeamPreviewData.borderColor = color;
        const hexSpan = document.getElementById('borderColorHex');
        if (hexSpan) {
            hexSpan.textContent = color;
        }
        
        // Re-render the Team Lead & Assists display to update border color
        const rosterLeadsDisplay = document.getElementById('rosterLeadsDisplay');
        if (rosterLeadsDisplay) {
            rosterLeadsDisplay.innerHTML = renderTeamLeadAndAssistsDisplay(
                window.currentTeamPreviewData.raidLeader,
                window.currentTeamPreviewData.raidAssists || [],
                color
            );
        }
    }
}

// Update team Warcraft Logs URL
function updateTeamWarcraftLogsUrl(url) {
    if (window.currentTeamPreviewData) {
        window.currentTeamPreviewData.warcraftLogsTeamUrl = url.trim() || '';
    }
}

// Handle team logo upload with image resizing
function handleTeamLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's an image file (accept all image types)
    if (!file.type || !file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPEG, GIF, WebP, etc.)');
        event.target.value = ''; // Clear input
        return;
    }
    
    // Validate file size (5MB max before resizing - we'll compress it)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
        alert('File size too large. Please upload an image smaller than 5MB.');
        event.target.value = ''; // Clear input
        return;
    }
    
    // Resize and compress image (48x48px max, 0.75 quality for fastest processing)
    // 48px is 1.5x the display size (32px) - good quality while being much faster
    resizeImage(file, 48, 48, 0.75, function(resizedBase64) {
        updateTeamLogo(resizedBase64);
    });
}

// Resize image using canvas
function resizeImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Use medium quality settings for faster processing (good enough for small logos)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            
            // Draw resized image
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with compression
            const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
            callback(resizedBase64);
        };
        img.onerror = function() {
            alert('Error processing image. Please try again.');
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
}

// Update team logo in preview
function updateTeamLogo(base64Data) {
    if (!window.currentTeamPreviewData) return;
    
    window.currentTeamPreviewData.teamLogo = base64Data;
    
    // Re-render preview to show logo
    renderTeamPreview(window.currentTeamPreviewData);
}

// Remove team logo
function removeTeamLogo() {
    if (!window.currentTeamPreviewData) return;
    
    if (confirm('Remove team logo?')) {
        window.currentTeamPreviewData.teamLogo = null;
        
        // Clear file input
        const fileInput = document.getElementById('teamLogoUpload');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Re-render preview
        renderTeamPreview(window.currentTeamPreviewData);
    }
}

// Update progression data in window.currentTeamPreviewData
function updateTeamProgression() {
    if (!window.currentTeamPreviewData) return;
    
    const bossesKilledEl = document.getElementById('bossesKilled');
    const totalBossesEl = document.getElementById('totalBosses');
    const highestDifficultyEl = document.getElementById('highestDifficulty');
    
    if (!window.currentTeamPreviewData.progress) {
        window.currentTeamPreviewData.progress = {};
    }
    
    if (bossesKilledEl) {
        const value = bossesKilledEl.value.trim();
        window.currentTeamPreviewData.progress.bossesKilled = value === '' ? null : parseInt(value);
    }
    if (totalBossesEl) {
        window.currentTeamPreviewData.progress.totalBosses = parseInt(totalBossesEl.value) || 8;
    }
    if (highestDifficultyEl) {
        window.currentTeamPreviewData.progress.highestDifficulty = highestDifficultyEl.value || null;
    }
}

// Save team (create or update) - updated version
async function saveTeam(event) {
    event.preventDefault();
    
    // Get data from preview if available, otherwise from form
    let teamData;
    
    if (window.currentTeamPreviewData) {
        // Update progression data from DOM (in case onchange didn't fire)
        updateTeamProgression();
        
        // Read Warcraft Logs URL from input field (in case it was updated)
        const urlInput = document.getElementById('teamWarcraftLogsUrl');
        const warcraftLogsUrl = urlInput ? urlInput.value.trim() : (window.currentTeamPreviewData.warcraftLogsTeamUrl || '');
        
        // Use preview data (progression should already be updated in window.currentTeamPreviewData)
        teamData = {
            ...window.currentTeamPreviewData,
            teamName: window.currentTeamPreviewData.teamName || document.getElementById('teamName')?.value.trim() || '',
            warcraftLogsTeamUrl: warcraftLogsUrl,
            progress: window.currentTeamPreviewData.progress || {
                bossesKilled: null,
                totalBosses: 8,
                highestDifficulty: null
            },
            borderColor: document.getElementById('teamBorderColor')?.value || window.currentTeamPreviewData.borderColor || '#6B7280'
        };
        
        // Update roster roles based on preview selections
        // Players already have roles set from preview editing, so we just need to ensure consistency
        const roster = teamData.roster || [];
        
        // Get raid leader and assist names FIRST (like organizeRosterByRole does)
        const raidLeaderName = teamData.raidLeader ? (teamData.raidLeader.characterName || teamData.raidLeader.name || '').toLowerCase().trim() : '';
        const raidLeaderNameAlt = teamData.raidLeader ? (teamData.raidLeader.name || teamData.raidLeader.characterName || '').toLowerCase().trim() : '';
        const assistNames = new Set();
        (teamData.raidAssists || []).forEach(assist => {
            const assistName = (assist.characterName || assist.name || '').toLowerCase().trim();
            const assistNameAlt = (assist.name || assist.characterName || '').toLowerCase().trim();
            if (assistName) assistNames.add(assistName);
            if (assistNameAlt) assistNames.add(assistNameAlt);
        });
        
        // Helper function to check if a player is a leader or assist (like organizeRosterByRole)
        const isLeaderOrAssist = (player) => {
            const playerName = (player.characterName || player.name || '').toLowerCase().trim();
            const playerNameAlt = (player.name || player.characterName || '').toLowerCase().trim();
            const isLeader = raidLeaderName && (playerName === raidLeaderName || playerName === raidLeaderNameAlt || playerNameAlt === raidLeaderName || playerNameAlt === raidLeaderNameAlt);
            const isAssist = assistNames.has(playerName) || assistNames.has(playerNameAlt);
            return isLeader || isAssist;
        };
        
        // Get all players from preview sections and ensure roles are set correctly
        // EXCLUDE raid leader and assists (same as organizeRosterByRole)
        const tanks = Array.from(document.querySelectorAll('#rosterTanks .roster-player-item')).map(el => {
            const name = el.querySelector('.player-name-small')?.textContent;
            if (!name) return null;
            const player = roster.find(p => (p.name || p.characterName) === name);
            if (player && !isLeaderOrAssist(player)) {
                player.role = 'Tank';
                return player;
            }
            return null;
        }).filter(Boolean);
        
        const healers = Array.from(document.querySelectorAll('#rosterHealers .roster-player-item')).map(el => {
            const name = el.querySelector('.player-name-small')?.textContent;
            if (!name) return null;
            const player = roster.find(p => (p.name || p.characterName) === name);
            if (player && !isLeaderOrAssist(player)) {
                player.role = 'Healer';
                return player;
            }
            return null;
        }).filter(Boolean);
        
        const dps = Array.from(document.querySelectorAll('#rosterDPS .roster-player-item')).map(el => {
            const name = el.querySelector('.player-name-small')?.textContent;
            if (!name) return null;
            const player = roster.find(p => (p.name || p.characterName) === name);
            if (player && !isLeaderOrAssist(player)) {
                player.role = 'DPS';
                return player;
            }
            return null;
        }).filter(Boolean);
        
        // Get team lead role from preview (if set) - use the dedicated select
        const teamLeadRoleSelect = document.getElementById('teamLeadRoleSelect');
        if (teamLeadRoleSelect && teamData.raidLeader) {
            teamData.raidLeader.leaderRole = teamLeadRoleSelect.value || '';
        }
        
        // Get team assist roles from preview (if set)
        const assistSelects = document.querySelectorAll('.team-assist-role-select');
        assistSelects.forEach((select, idx) => {
            if (teamData.raidAssists && teamData.raidAssists[idx]) {
                teamData.raidAssists[idx].assistRole = select.value || '';
            }
        });
        
        // Ensure all roster players are included (including any not in preview sections)
        const allProcessedNames = new Set([...tanks, ...healers, ...dps].map(p => (p.name || p.characterName).toLowerCase().trim()));
        
        const remainingPlayers = roster.filter(p => {
            const playerName = (p.name || p.characterName || '').toLowerCase().trim();
            const isLeader = raidLeaderName && playerName === raidLeaderName;
            const isAssist = assistNames.has(playerName);
            const isProcessed = allProcessedNames.has(playerName);
            const isTeamAssist = (p.role || '').toLowerCase() === 'team assist';
            return !isLeader && !isAssist && !isProcessed && !isTeamAssist;
        });
        
        // Set default role for any remaining players
        remainingPlayers.forEach(p => {
            if (!p.role || (p.role || '').toLowerCase() === 'team assist') {
                p.role = 'DPS';
            }
        });
        
        // Handle Team Assist players - ensure they're in raidAssists
        roster.forEach(p => {
            const playerRole = (p.role || '').toLowerCase();
            if (playerRole === 'team assist') {
                const playerName = (p.name || p.characterName || '').toLowerCase().trim();
                const isInAssists = assistNames.has(playerName);
                if (!isInAssists && !teamData.raidAssists) {
                    teamData.raidAssists = [];
                }
                if (!isInAssists) {
                    teamData.raidAssists.push(p);
                    assistNames.add(playerName);
                }
            }
        });
        
        // Combine all players: tanks, healers, dps, and any remaining players
        // IMPORTANT: Exclude raid assists and team lead from the roster array (they're stored separately, just like organizeRosterByRole does)
        teamData.roster = [...tanks, ...healers, ...dps, ...remainingPlayers].filter(p => !isLeaderOrAssist(p));
    } else {
        // Fallback to form data (for backwards compatibility - should not happen if preview is used)
        const teamName = document.getElementById('teamName').value.trim();
        const warcraftLogsUrl = document.getElementById('warcraftLogsUrl').value.trim();
        
        if (!teamName) {
            alert('Please fill in Team Name, then click "Preview & Edit Team" to set up your team');
            return;
        }
        
        // No roster or preview data - can't save without preview
        alert('Please click "Fetch Team Data" or "Create with no URL", then click "Preview & Edit Team" to set up your team before publishing');
        return;
    }
    
    // Team Name is required, Warcraft Logs URL and Raid Leader are optional
    if (!teamData.teamName) {
        alert('Missing required field: Team Name is required');
        return;
    }
    
    const saveBtn = document.getElementById('saveTeamBtn');
    const originalText = saveBtn.textContent;
    
    saveBtn.disabled = true;
    saveBtn.textContent = editingTeamId ? 'Publishing...' : 'Publishing to Sidebar...';
    
    try {
        const url = editingTeamId 
            ? `${API_BASE}/team-editor/teams/${editingTeamId}`
            : `${API_BASE}/team-editor/teams`;
        const method = editingTeamId ? 'PUT' : 'POST';
        
        // Ensure required fields are present
        if (!teamData.teamName) {
            alert('Missing required field: Team Name is required');
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            return;
        }
        
        // Ensure warcraftLogsTeamUrl is always a string (empty string if not provided)
        if (teamData.warcraftLogsTeamUrl === undefined || teamData.warcraftLogsTeamUrl === null) {
            teamData.warcraftLogsTeamUrl = '';
        }
        
        console.log('Saving team data:', { teamName: teamData.teamName, warcraftLogsTeamUrl: teamData.warcraftLogsTeamUrl });
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(teamData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Team saved:', result);
        
        // Reset form and reload teams
        resetTeamForm();
        window.currentTeamPreviewData = null;
        document.getElementById('teamPreviewSection').style.display = 'none';
        await loadSavedTeams();
        // Also reload sidebar teams
        await loadGuildTeams();
        
        alert(`Team ${editingTeamId ? 'updated' : 'published'} successfully to sidebar!`);
    } catch (error) {
        console.error('Error saving team:', error);
        alert(`Error saving team: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// Edit team
async function editTeam(teamId) {
    try {
        const response = await fetch(`${API_BASE}/team-editor/teams/${teamId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const team = await response.json();
        
        // Reset form first to clear any previous state
        resetTeamForm();
        
        // Populate form (only team name and URL - raid leader/assists are set in preview)
        document.getElementById('teamName').value = team.teamName || '';
        document.getElementById('warcraftLogsUrl').value = team.warcraftLogsTeamUrl || '';
        
        // Ensure roster array exists
        if (!team.roster) {
            team.roster = [];
        }
        if (!team.raidAssists) {
            team.raidAssists = [];
        }
        if (!team.progress) {
            team.progress = {
                bossesKilled: null,
                totalBosses: 8,
                highestDifficulty: null
            };
        }
        if (!team.borderColor) {
            team.borderColor = '#6B7280';
        }
        
        // Store team data for preview (since we have full team data, we can show preview)
        window.currentTeamPreviewData = team;
        
        // Always show preview (even with empty roster)
        renderTeamPreview(team);
        document.getElementById('teamPreviewSection').style.display = 'block';
        document.getElementById('previewTeamBtn').style.display = 'none';
        document.getElementById('saveTeamBtn').style.display = 'inline-block';
        
        // Update UI
        editingTeamId = teamId;
        document.getElementById('teamEditorFormTitle').textContent = 'Edit Team';
        document.getElementById('saveTeamBtn').textContent = 'Update Team';
        document.getElementById('cancelTeamBtn').style.display = 'inline-block';
        
        // Scroll to form or preview
        if (team.roster && team.roster.length > 0) {
            document.getElementById('teamPreviewSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            document.getElementById('teamEditorForm').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Error loading team for edit:', error);
        alert(`Error loading team: ${error.message}`);
    }
}

// Delete team
async function deleteTeam(teamId) {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/team-editor/teams/${teamId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
        }
        
        await loadSavedTeams();
        await loadGuildTeams(); // Reload sidebar
        
        alert('Team deleted successfully!');
    } catch (error) {
        console.error('Error deleting team:', error);
        alert(`Error deleting team: ${error.message}`);
    }
}

// Reset team form
function resetTeamForm() {
    document.getElementById('teamEditorForm').reset();
    editingTeamId = null;
    window.currentTeamPreviewData = null;
    
    // Reset UI elements
    document.getElementById('teamEditorFormTitle').textContent = 'Add New Team';
    document.getElementById('saveTeamBtn').textContent = 'Publish to Sidebar';
    document.getElementById('saveTeamBtn').style.display = 'none';
    document.getElementById('previewTeamBtn').style.display = 'none';
    document.getElementById('cancelTeamBtn').style.display = 'none';
    
    // Hide preview section
    const previewSection = document.getElementById('teamPreviewSection');
    if (previewSection) {
        previewSection.style.display = 'none';
    }
}

async function syncGoogleSheets() {
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');
    
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    syncStatus.innerHTML = '<span style="color: var(--eclipse-accent);">🔄 Syncing from Google Sheets...</span>';
    
    try {
        const response = await fetch(`${API_BASE}/sync-sheets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Check if response is actually JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            throw new Error(`Server returned ${response.status}: ${response.statusText}. Make sure the server is running and the endpoint exists.`);
        }
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || result.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        if (result.success) {
            syncStatus.innerHTML = `<span style="color: #4ade80;">✅ Sync successful! Synced ${result.rows} rows at ${new Date().toLocaleTimeString()}</span>`;
            // Reload the data after sync
            setTimeout(() => {
                loadApplicant();
            }, 500);
        } else {
            // Format the error message with better styling for multi-line instructions
            let errorHtml = `<span style="color: #f87171;">❌ Sync failed: ${escapeHtml(result.error || result.message)}</span>`;
            if (result.message && result.message.includes('Steps to fix:')) {
                errorHtml = `<div style="color: #f87171;">
                    <strong>❌ Sync failed: ${escapeHtml(result.error || 'Google Sheet not accessible')}</strong><br>
                    <div style="margin-top: 10px; padding: 10px; background: rgba(248, 113, 113, 0.1); border-left: 3px solid #f87171; border-radius: 4px;">
                        ${escapeHtml(result.message).replace(/\n/g, '<br>')}
                    </div>
                </div>`;
            }
            syncStatus.innerHTML = errorHtml;
        }
    } catch (error) {
        console.error('Error syncing Google Sheets:', error);
        let errorMessage = error.message;
        if (errorMessage.includes('<!DOCTYPE')) {
            errorMessage = 'Server returned HTML instead of JSON. Make sure the server is running and the /api/sync-sheets endpoint exists.';
        } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
            errorMessage = 'Google Sheet is not published. Please publish it: File → Share → Publish to web → CSV format → Publish';
        }
        syncStatus.innerHTML = `<span style="color: #f87171;">❌ Error: ${escapeHtml(errorMessage)}</span>`;
    } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync from Google Sheets';
    }
}

async function loadApplicant() {
    const container = document.getElementById('applicantContent');
    container.innerHTML = '<div class="loading">Loading applicant data...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/applicant`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Filter out completely empty rows first
            const filteredData = data.data.filter(row => 
                row && Array.isArray(row) && row.some(cell => cell && String(cell).trim() !== '')
            );
            
            if (filteredData.length === 0) {
                container.innerHTML = '<div class="empty">No data found in CSV file</div>';
                return;
            }
            
            // Find the maximum number of columns
            const maxCols = Math.max(...filteredData.map(row => row ? row.length : 0));
            
            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            const table = document.createElement('table');
            table.className = 'csv-table';
            
            // Create header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            for (let i = 0; i < maxCols; i++) {
                const th = document.createElement('th');
                th.textContent = `Column ${i + 1}`;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Function to get color class based on cell value
            function getCellColorClass(value) {
                if (!value || typeof value !== 'string') return '';
                const val = value.trim().toLowerCase();
                
                // Status colors
                if (val === 'full' || val.includes('full')) return 'cell-status-full';
                if (val.includes('recruiting') || val.includes('looking for')) return 'cell-status-recruiting';
                if (val === 'need now' || val.includes('need now')) return 'cell-status-need-now';
                if (val.includes('bench available')) return 'cell-status-bench';
                if (val === 'new team!') return 'cell-status-new-team';
                
                // Class/Role colors (common WoW classes)
                if (val.includes('druid')) return 'cell-class-druid';
                if (val.includes('warrior')) return 'cell-class-warrior';
                if (val.includes('paladin')) return 'cell-class-paladin';
                if (val.includes('hunter')) return 'cell-class-hunter';
                if (val.includes('rogue')) return 'cell-class-rogue';
                if (val.includes('priest')) return 'cell-class-priest';
                if (val.includes('shaman')) return 'cell-class-shaman';
                if (val.includes('mage')) return 'cell-class-mage';
                if (val.includes('warlock')) return 'cell-class-warlock';
                if (val.includes('monk')) return 'cell-class-monk';
                if (val.includes('demon hunter') || val.includes('dh')) return 'cell-class-dh';
                if (val.includes('evoker')) return 'cell-class-evoker';
                if (val.includes('death knight') || val.includes('dk')) return 'cell-class-dk';
                
                // Role colors
                if (val.includes('tank')) return 'cell-role-tank';
                if (val.includes('healer')) return 'cell-role-healer';
                if (val.includes('dps') || val.includes('melee') || val.includes('ranged')) return 'cell-role-dps';
                
                return '';
            }
            
            // Create body
            const tbody = document.createElement('tbody');
            for (const row of filteredData) {
                const tr = document.createElement('tr');
                for (let i = 0; i < maxCols; i++) {
                    const td = document.createElement('td');
                    const cellValue = (row[i] !== undefined && row[i] !== null) ? String(row[i]) : '';
                    td.textContent = cellValue;
                    
                    // Add color class based on cell value
                    const colorClass = getCellColorClass(cellValue);
                    if (colorClass) {
                        td.className = colorClass;
                    }
                    
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            
            fragment.appendChild(table);
            container.innerHTML = '';
            container.appendChild(fragment);
            
            updateLastUpdated(data.lastUpdated);
            
            // Update sync status
            const syncStatus = document.getElementById('syncStatus');
            if (syncStatus && !syncStatus.textContent.includes('Sync')) {
                syncStatus.innerHTML = `<span style="color: var(--eclipse-text-dim);">📊 Data loaded: ${filteredData.length} rows | Last updated: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Unknown'}</span>`;
            }
        } else {
            container.innerHTML = '<div class="empty">No applicant data found</div>';
        }
    } catch (error) {
        console.error('Error loading applicant data:', error);
        container.innerHTML = '<div class="empty">Error loading applicant data: ' + escapeHtml(error.message) + '</div>';
    }
}

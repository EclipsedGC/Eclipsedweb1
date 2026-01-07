const API_BASE = 'http://localhost:3001/api';

let currentTab = 'applicants';

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    checkStatus();
    loadApplicants();
    
    setInterval(checkStatus, 30000);
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
                loadGuilds();
            } else if (tabName === 'blogs') {
                loadBlogs();
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
        
        const hasData = status.applicants || status.guilds || status.blogs;
        
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
    container.innerHTML = '<div class="loading">Loading guilds...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/guilds`);
        const data = await response.json();
        
        if (data.guilds && data.guilds.length > 0) {
            container.innerHTML = data.guilds.map(guild => `
                <div class="data-card">
                    <h3>${escapeHtml(guild.name)}</h3>
                    <div class="meta">
                        <span><strong>Realm:</strong> ${escapeHtml(guild.realm)}</span>
                        <span><strong>Region:</strong> ${escapeHtml(guild.region)}</span>
                        <span><strong>Progression:</strong> ${escapeHtml(guild.progression)}</span>
                        <span><strong>Members:</strong> ${escapeHtml(guild.members)}</span>
                        <span><strong>IO Score:</strong> ${escapeHtml(guild.ioScore)}</span>
                        <span><strong>Source:</strong> ${escapeHtml(guild.source)}</span>
                    </div>
                    ${guild.url ? `<a href="${guild.url}" target="_blank">View on ${guild.source}</a>` : ''}
                </div>
            `).join('');
            
            updateLastUpdated(data.lastUpdated);
        } else {
            container.innerHTML = '<div class="empty">No guilds found</div>';
        }
    } catch (error) {
        console.error('Error loading guilds:', error);
        container.innerHTML = '<div class="empty">Error loading guilds. Make sure the scraper has run.</div>';
    }
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


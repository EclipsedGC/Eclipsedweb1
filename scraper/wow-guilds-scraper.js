import axios from 'axios';
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export async function scrapeWoWGuilds(realm, region = 'us') {
  try {
    const sources = [
      {
        name: 'Raider.io Guilds',
        url: `https://raider.io/guilds/${region}/${realm}`,
        selector: '.guild-row, .guild-item, [class*="guild"]'
      },
      {
        name: 'WoWProgress',
        url: `https://www.wowprogress.com/realms/rank/us/${encodeURIComponent(realm)}`,
        selector: '.guild, .guild-row, tr'
      }
    ];

    const allGuilds = [];

    for (const source of sources) {
      try {
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        $(source.selector).each((i, elem) => {
          const $elem = $(elem);
          const guildName = $elem.find('.guild-name, .name, a').first().text().trim();
          
          if (guildName && guildName.length > 0) {
            const guild = {
              name: guildName,
              realm: realm,
              region: region,
              progression: $elem.find('.progression, .progress, [class*="progress"]').first().text().trim() || 'N/A',
              members: $elem.find('.members, .member-count, [class*="member"]').first().text().trim() || 'N/A',
              ioScore: $elem.find('.rio-score, .score, [class*="score"]').first().text().trim() || 'N/A',
              source: source.name,
              url: $elem.find('a').first().attr('href') || ''
            };

            if (!allGuilds.find(g => g.name === guild.name && g.realm === guild.realm)) {
              allGuilds.push(guild);
            }
          }
        });
      } catch (error) {
        console.log(`Error scraping ${source.name}:`, error.message);
      }
    }

    const data = {
      guilds: allGuilds,
      lastUpdated: new Date().toISOString(),
      realm: realm,
      region: region
    };

    writeFileSync(join(DATA_DIR, 'guilds.json'), JSON.stringify(data, null, 2));
    console.log(`Scraped ${allGuilds.length} guilds`);
    
    return data;
  } catch (error) {
    console.error('Error scraping WoW guilds:', error.message);
    return { guilds: [], lastUpdated: new Date().toISOString(), error: error.message };
  }
}


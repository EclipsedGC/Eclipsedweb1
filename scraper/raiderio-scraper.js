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

export async function scrapeRaiderIOApplicants(guildName, realm, region = 'us') {
  try {
    const url = `https://raider.io/guilds/${region}/${realm}/${encodeURIComponent(guildName)}/applications`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const applicants = [];

    $('.applicant-row, .application-item, [class*="applicant"]').each((i, elem) => {
      const $elem = $(elem);
      
      const applicant = {
        name: $elem.find('.character-name, .name, [class*="name"]').first().text().trim() || 'Unknown',
        class: $elem.find('.character-class, .class, [class*="class"]').first().text().trim() || 'Unknown',
        itemLevel: $elem.find('.item-level, .ilvl, [class*="ilvl"]').first().text().trim() || 'N/A',
        ioScore: $elem.find('.rio-score, .score, [class*="score"]').first().text().trim() || 'N/A',
        message: $elem.find('.application-message, .message, [class*="message"]').first().text().trim() || '',
        date: $elem.find('.date, .timestamp, [class*="date"]').first().text().trim() || new Date().toISOString()
      };

      if (applicant.name !== 'Unknown') {
        applicants.push(applicant);
      }
    });

    if (applicants.length === 0) {
      console.log('No applicants found with standard selectors, trying alternative approach...');
      $('tr, .row, [class*="row"]').each((i, elem) => {
        const $elem = $(elem);
        const text = $elem.text();
        if (text.includes('applicant') || text.includes('application') || text.length > 50) {
          const name = $elem.find('a, .character, [class*="character"]').first().text().trim();
          if (name) {
            applicants.push({
              name: name,
              class: 'Unknown',
              itemLevel: 'N/A',
              ioScore: 'N/A',
              message: text.substring(0, 200),
              date: new Date().toISOString()
            });
          }
        }
      });
    }

    const data = {
      applicants: applicants,
      lastUpdated: new Date().toISOString(),
      source: 'Raider.io',
      guild: guildName,
      realm: realm,
      region: region
    };

    writeFileSync(join(DATA_DIR, 'applicants.json'), JSON.stringify(data, null, 2));
    console.log(`Scraped ${applicants.length} applicants from Raider.io`);
    
    return data;
  } catch (error) {
    console.error('Error scraping Raider.io:', error.message);
    return { applicants: [], lastUpdated: new Date().toISOString(), error: error.message };
  }
}


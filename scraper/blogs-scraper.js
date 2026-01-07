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

export async function scrapeWarcraftBlogs() {
  try {
    const blogSources = [
      {
        name: 'WoW Official Blog',
        url: 'https://worldofwarcraft.blizzard.com/en-us/news',
        selector: '.article-item, .news-item, article'
      },
      {
        name: 'MMO-Champion',
        url: 'https://www.mmo-champion.com/content/',
        selector: '.news-item, article, .post'
      },
      {
        name: 'WoWHead News',
        url: 'https://www.wowhead.com/news',
        selector: '.news-item, article, .post-item'
      }
    ];

    const allBlogs = [];

    for (const source of blogSources) {
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
          const title = $elem.find('h1, h2, h3, .title, [class*="title"]').first().text().trim();
          const link = $elem.find('a').first().attr('href') || '';
          const fullLink = link.startsWith('http') ? link : new URL(link, source.url).href;
          
          if (title && title.length > 0) {
            const blog = {
              title: title,
              excerpt: $elem.find('.excerpt, .summary, p').first().text().trim().substring(0, 200) || '',
              author: $elem.find('.author, [class*="author"]').first().text().trim() || 'Unknown',
              date: $elem.find('.date, .published, [class*="date"]').first().text().trim() || new Date().toISOString(),
              url: fullLink,
              source: source.name
            };

            if (!allBlogs.find(b => b.title === blog.title && b.source === blog.source)) {
              allBlogs.push(blog);
            }
          }
        });
      } catch (error) {
        console.log(`Error scraping ${source.name}:`, error.message);
      }
    }

    const data = {
      blogs: allBlogs,
      lastUpdated: new Date().toISOString()
    };

    writeFileSync(join(DATA_DIR, 'blogs.json'), JSON.stringify(data, null, 2));
    console.log(`Scraped ${allBlogs.length} blog posts`);
    
    return data;
  } catch (error) {
    console.error('Error scraping Warcraft blogs:', error.message);
    return { blogs: [], lastUpdated: new Date().toISOString(), error: error.message };
  }
}


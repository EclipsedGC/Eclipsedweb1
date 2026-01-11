YALL BITCHES
# Kitana - WoW Portal

A World of Warcraft guild applicant and blog aggregator portal with automated web scraping.

## Features

- **Raider.io Applicant Scraper**: Pulls applicant data from Raider.io guild applications
- **WoW Guilds Scraper**: Aggregates guild information from multiple sources
- **Warcraft Blogs Scraper**: Collects blog posts from official and community sources
- **Eclipse-themed UI**: Dark, modern interface
- **Automated Scheduling**: Timed web scraper runs every 6 hours (configurable)
- **REST API**: JSON endpoints for all scraped data
- **Real-time Portal**: Web interface to view all aggregated data

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure scraping settings (optional):
Create a `.env` file or set environment variables:
```
GUILD_NAME=YourGuild
REALM=Area-52
REGION=us
SCRAPE_INTERVAL=0 */6 * * *
```

## Usage

### Start the Server
```bash
npm start
```

The portal will be available at `http://localhost:3000`

### Run the Scraper Scheduler
In a separate terminal:
```bash
npm run scraper
```

The scheduler will:
- Run an initial scrape immediately
- Continue scraping on the configured interval (default: every 6 hours)

### Development Mode
```bash
npm run dev
```

## API Endpoints

- `GET /api/applicants` - Get all scraped applicants
- `GET /api/guilds` - Get all scraped guilds
- `GET /api/blogs` - Get all scraped blog posts
- `GET /api/status` - Check scraping status

## Project Structure

```
Kitana/
├── server.js              # Express server
├── scraper/
│   ├── raiderio-scraper.js    # Raider.io applicant scraper
│   ├── wow-guilds-scraper.js  # WoW guilds scraper
│   ├── blogs-scraper.js       # Blog posts scraper
│   └── scheduler.js           # Cron scheduler
├── public/
│   ├── index.html         # Portal UI
│   ├── styles.css         # Eclipse theme styles
│   └── app.js             # Frontend JavaScript
└── data/                  # Scraped data storage (auto-created)
```

## Notes

- The scrapers use multiple selector strategies to handle different website layouts
- Data is stored in JSON files in the `data/` directory
- The portal automatically refreshes data when switching tabs
- Scrapers include error handling and fallback strategies

## Customization

To customize scraping targets, edit the respective scraper files:
- `scraper/raiderio-scraper.js` - Modify guild name, realm, or region
- `scraper/wow-guilds-scraper.js` - Add/remove guild sources
- `scraper/blogs-scraper.js` - Add/remove blog sources


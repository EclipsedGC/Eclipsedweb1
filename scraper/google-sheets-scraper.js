import axios from 'axios';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHEET_ID = '1rL-twnLEQ_hDmXsIBNyRjTXhZOHqVes5AbTP50KVBzo';
const GID = '2027893423';
// Try published CSV export URL first, then fallback to export URL
const CSV_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}&usp=sharing`;
const CSV_PUBLISHED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
const OUTPUT_FILE = join(__dirname, '..', 'Eclipsed Recruitment - Leadership.csv');

export async function scrapeGoogleSheets() {
  const urls = [CSV_PUBLISHED_URL, CSV_EXPORT_URL];
  
  for (const url of urls) {
    try {
      console.log(`[${new Date().toISOString()}] Fetching Google Sheets data from ${url.includes('gviz') ? 'published URL' : 'export URL'}...`);
      
      // Fetch CSV from Google Sheets
      const response = await axios.get(url, {
        responseType: 'text',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/csv,text/plain,*/*'
        }
      });

      if (response.status === 200 && response.data) {
        // Ensure the directory exists
        const outputDir = dirname(OUTPUT_FILE);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        // Write the CSV data to file
        writeFileSync(OUTPUT_FILE, response.data, 'utf8');
        
        const rowCount = response.data.split('\n').filter(line => line.trim()).length;
        console.log(`[${new Date().toISOString()}] Successfully synced Google Sheets to ${OUTPUT_FILE} (${rowCount} rows)`);
        return { success: true, rows: rowCount };
      }
    } catch (error) {
      // If this is the last URL, throw the error
      if (url === urls[urls.length - 1]) {
        console.error(`[${new Date().toISOString()}] Error syncing Google Sheets:`, error.message);
        
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          
          if (error.response.status === 401 || error.response.status === 403) {
            console.error('\n⚠️  IMPORTANT: The Google Sheet needs to be published for public access.');
            console.error('   To fix this:');
            console.error('   1. Open the Google Sheet');
            console.error('   2. Go to File > Share > Publish to web');
            console.error('   3. Select the specific sheet/tab (gid: ' + GID + ')');
            console.error('   4. Choose "Comma-separated values (.csv)"');
            console.error('   5. Click "Publish"');
          }
        }
        
        // Create a more helpful error message
        let errorMessage = error.message;
        if (error.response) {
          if (error.response.status === 401 || error.response.status === 403) {
            errorMessage = `Google Sheet is not published for public access (HTTP ${error.response.status}). Please publish the sheet: File > Share > Publish to web > Select CSV format > Publish`;
          } else if (error.response.status === 404) {
            errorMessage = `Google Sheet not found. Please check the Sheet ID and GID.`;
          } else {
            errorMessage = `Failed to fetch Google Sheet (HTTP ${error.response.status}): ${error.message}`;
          }
        }
        throw new Error(errorMessage);
      }
      // Otherwise, try the next URL
      console.log(`[${new Date().toISOString()}] Trying alternative URL...`);
      continue;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  scrapeGoogleSheets()
    .then(() => {
      console.log('Sync completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}

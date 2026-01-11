# Google Sheets Sync Setup

The application syncs with your Google Sheet every hour automatically. To enable this feature, you need to publish your Google Sheet for public access.

## Setup Instructions

1. **Open your Google Sheet**: https://docs.google.com/spreadsheets/d/1rL-twnLEQ_hDmXsIBNyRjTXhZOHqVes5AbTP50KVBzo/edit?gid=2027893423#gid=2027893423

2. **Publish the Sheet**:
   - Click on **File** → **Share** → **Publish to web**
   - In the dialog, select the specific sheet/tab you want to publish (the one with gid: 2027893423)
   - Choose **"Comma-separated values (.csv)"** as the format
   - Click **"Publish"**
   - Copy the published link (you don't need to use it, but it confirms it's published)

3. **Verify the Sync**:
   - The sync runs automatically every hour
   - You can also manually trigger a sync by calling: `POST http://localhost:3001/api/sync-sheets`
   - Or run: `npm run sync-sheets`

## How It Works

- The scraper fetches the CSV export from your published Google Sheet
- It saves the data to `Eclipsed Recruitment - Leadership.csv`
- The sync runs automatically every hour via cron job
- The "Applicant" tab displays the synced data

## Troubleshooting

If you see a 401 or 403 error:
- Make sure the sheet is published (File → Share → Publish to web)
- Verify you selected the correct sheet/tab
- Check that CSV format is selected

If the sync fails:
- Check the server logs for detailed error messages
- Verify the sheet ID and GID are correct in `scraper/google-sheets-scraper.js`
- Ensure the sheet is accessible without authentication

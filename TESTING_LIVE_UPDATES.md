# Testing Live Updates from Google Sheets

## Quick Test Guide

### Method 1: Using the UI (Easiest)

1. **Start the server** (if not already running):
   ```bash
   npm start
   ```

2. **Open the portal** in your browser:
   ```
   http://localhost:3001
   ```

3. **Click on the "Applicant" tab**

4. **Click the "Sync from Google Sheets" button**
   - You'll see a status message showing the sync progress
   - The data will automatically refresh after sync completes

5. **Make a change in your Google Sheet** (add/edit/delete a row)

6. **Click "Sync from Google Sheets" again** to see the changes

### Method 2: Using Command Line

1. **Manual sync command**:
   ```bash
   npm run sync-sheets
   ```

2. **Check the output** - you should see:
   ```
   [timestamp] Fetching Google Sheets data...
   [timestamp] Successfully synced Google Sheets to [path] (X rows)
   ```

### Method 3: Using the API Endpoint

You can trigger a sync via HTTP POST request:

```bash
# Using curl (if installed)
curl -X POST http://localhost:3001/api/sync-sheets

# Using PowerShell
Invoke-WebRequest -Uri http://localhost:3001/api/sync-sheets -Method POST
```

### Method 4: Automatic Hourly Sync

1. **Start the scheduler**:
   ```bash
   npm run scraper
   ```

2. The scheduler will:
   - Run an initial sync immediately
   - Then sync every hour automatically (at minute 0 of each hour)
   - Log all sync attempts to the console

## Testing Steps

### Step 1: Verify Initial Setup
1. Make sure your Google Sheet is published (File → Share → Publish to web)
2. Start the server: `npm start`
3. Open the portal and check the "Applicant" tab shows data

### Step 2: Test Manual Sync
1. Note the current data in the portal
2. Make a change in your Google Sheet (e.g., add a new row, change a value)
3. Click "Sync from Google Sheets" button
4. Verify the changes appear in the portal

### Step 3: Test Automatic Sync
1. Start the scheduler: `npm run scraper`
2. Make a change in your Google Sheet
3. Wait for the next hour (or modify the cron schedule for testing)
4. Check the console logs to see the sync happen automatically

### Step 4: Test Error Handling
1. Temporarily unpublish your Google Sheet
2. Try syncing - you should see an error message
3. Republish the sheet and sync again - should work

## Troubleshooting

### Sync button doesn't work
- Check browser console for errors (F12)
- Verify the server is running on port 3001
- Check network tab to see if the API call is being made

### "401 Unauthorized" error
- Your Google Sheet needs to be published
- Go to File → Share → Publish to web
- Select CSV format and click Publish

### Changes not appearing
- Make sure you clicked "Sync from Google Sheets" after making changes
- Check the sync status message for errors
- Try clicking "Refresh" button to reload the data
- Check server console for error messages

### Scheduler not running
- Make sure you started it with `npm run scraper`
- Check that node-cron is installed: `npm list node-cron`
- Look for error messages in the console

## Quick Test Script

For rapid testing, you can modify the scheduler to run more frequently:

Edit `scraper/scheduler.js` and change:
```javascript
cron.schedule('0 * * * *', runGoogleSheetsSync); // Every hour
```

To:
```javascript
cron.schedule('*/5 * * * *', runGoogleSheetsSync); // Every 5 minutes (for testing)
```

**Remember to change it back to hourly for production!**

## Monitoring

Watch the console output for:
- `[timestamp] Starting Google Sheets sync...`
- `[timestamp] Successfully synced Google Sheets...`
- `[timestamp] Error during Google Sheets sync...`

The UI will also show sync status in the "Applicant" tab.

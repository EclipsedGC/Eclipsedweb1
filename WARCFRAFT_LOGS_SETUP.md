# Warcraft Logs API Setup

The application now integrates Warcraft Logs API to display highest boss kill and overall character ranking for council members.

## Setup Instructions

1. **Get Warcraft Logs API Credentials:**
   - Go to https://www.warcraftlogs.com/api/clients
   - Log in to your Warcraft Logs account
   - Create a new API client application
   - Copy your **Client ID** and **Client Secret**

2. **Set Environment Variables:**
   - Create a `.env` file in the project root (if it doesn't exist)
   - Add the following variables:
   ```
   WARCRAFT_LOGS_CLIENT_ID=your_client_id_here
   WARCRAFT_LOGS_CLIENT_SECRET=your_client_secret_here
   ```
   - Or set them as system environment variables

3. **Restart the Server:**
   - After setting the credentials, restart the server to load them

## What Data is Fetched

When syncing council members, the system will:
- Fetch **Highest Boss Kill** - The most difficult boss the character has defeated
- Fetch **Overall Character Ranking** - The character's performance percentile (DPS/HPS)

This data will be displayed on each council member's card in the Raid Teams tab.

## API Limitations

- **Rate Limits**: Warcraft Logs API has rate limits. The system includes delays between requests.
- **Character Matching**: Characters must exist in Warcraft Logs with logs uploaded
- **Data Availability**: Some characters may not have Warcraft Logs data if they haven't raided or had logs uploaded

## Troubleshooting

**No Warcraft Logs data showing:**
- Verify API credentials are set correctly
- Check that characters have logs uploaded to Warcraft Logs
- Check server logs for API errors
- Verify character name and realm spelling match exactly

**API Authentication Errors:**
- Ensure Client ID and Client Secret are correct
- Check that your API client is active on Warcraft Logs
- Verify the credentials are set as environment variables

**GraphQL Query Errors:**
- The GraphQL query structure may need adjustment based on API version
- Check Warcraft Logs API documentation for the latest schema
- Update the query in `scraper/warcraft-logs-api.js` if needed

## Testing

After setup, trigger a sync:
```bash
POST http://localhost:3001/api/sync-guildsofwow
```

Check the server logs for:
- "✅ Warcraft Logs API access token obtained" - Authentication successful
- "📊 Warcraft Logs: [data]" - Data fetched successfully
- Any error messages for troubleshooting

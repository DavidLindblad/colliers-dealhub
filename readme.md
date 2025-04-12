@"
# Colliers DealHub Services

This repository contains two main services:

1. Bloomberg API Service (mailhub.colliersdealhub.com)
   - Fetches data from Bloomberg
   - Stores in Supabase
   - Runs on schedule

2. Market Data API (api.colliersdealhub.com)
   - Serves market data from Supabase
   - Provides REST endpoints
   - Supports JSON and CSV formats

## Services

### Bloomberg API
Located in \`/bloomberg-api\`
- Handles Bloomberg data integration
- Runs scheduled data fetching
- Updates Supabase database

### Market Data API
Located in \`/market-data-api\`
- Provides REST endpoints for data access
- Supports JSON and CSV formats
- Includes filtering and date range options

## Deployment

Services are deployed using Coolify to:
- Bloomberg API: mailhub.colliersdealhub.com
- Market Data API: api.colliersdealhub.com
"@ | Out-File -FilePath .\colliers-dealhub\README.md -Encoding UTF8
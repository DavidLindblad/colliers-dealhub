# Colliers DealHub Service

Bloomberg data integration service for Colliers DealHub that:
- Fetches data from Bloomberg
- Stores in Supabase
- Runs on schedule

## Data Access
Data can be accessed directly through Supabase REST API:

```
GET https://supabase.colliersdealhub.com/rest/v1/DailyMarketReport
  ?select=*
  &order=Date.desc
  &limit=100
```

## Deployment
Service is deployed using Coolify to:
- Bloomberg Integration: mailhub.colliersdealhub.com

# Bloomberg to Supabase Data Sync

This Node.js script fetches CSV data from the Bloomberg API twice daily and stores it in a self-hosted Supabase instance.

## Features

- Fetches CSV data from Bloomberg API
- Stores data in Supabase Storage (raw CSV files)
- Parses and stores structured data in Supabase tables
- Runs on a configurable schedule (default: 8:00 AM and 8:00 PM)
- Comprehensive error handling and logging
- Docker containerization support
- Coolify/Hetzner deployment ready

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Bloomberg API access
- Self-hosted Supabase instance
- Docker (for containerization)
- Coolify account and Hetzner server access

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   # Bloomberg API Configuration
   BLOOMBERG_API_ENDPOINT=https://api.bloomberg.com/v1/data
   BLOOMBERG_API_KEY=your_api_key_here

   # Supabase Configuration
   SUPABASE_URL=https://supabase.colliersdealhub.com
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   SUPABASE_BUCKET_NAME=bloomberg-csv-files
   SUPABASE_TABLE_NAME=bloomberg_data

   # Cron Schedule Configuration
   CRON_SCHEDULE_1=0 8 * * *  # 8:00 AM
   CRON_SCHEDULE_2=0 20 * * * # 8:00 PM
   ```

## Local Development

Start the application in development mode:
```bash
npm run dev
```

## Docker Usage

Build the Docker image:
```bash
npm run docker:build
```

Run the container:
```bash
npm run docker:run
```

View logs:
```bash
npm run docker:logs
```

Stop the container:
```bash
npm run docker:stop
```

## Deployment to Coolify/Hetzner

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. In Coolify:
   - Create a new application
   - Connect your GitHub repository
   - Select the branch to deploy (main)
   - Configure the following settings:
     - Build Method: Dockerfile
     - Port: 3000
     - Environment Variables: Add all variables from your .env file
   - Deploy the application

3. Set up GitHub webhook:
   - In your GitHub repository settings, go to Webhooks
   - Add a new webhook
   - Set the payload URL to your Coolify webhook URL
   - Content type: application/json
   - Select events: Push

Now, whenever you push changes to your GitHub repository, Coolify will automatically deploy the updates to your Hetzner server.

## Error Handling

The script includes comprehensive error handling for:
- API connection issues
- Data parsing errors
- Storage upload failures
- Database operations

All errors are logged to the console with detailed messages.

## Security Notes

- The `.env` file is included in `.gitignore` to prevent sensitive information from being committed
- Uses Supabase Service Role Key for database operations
- All API keys and credentials should be kept secure
- Environment variables are managed through Coolify's secure environment management

## License

MIT 
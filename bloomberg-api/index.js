// api.js
require('dotenv').config();
const http = require('http');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  }
);

// Allow all your subdomains
const allowedOrigins = [
  'https://colliersdealhub.com',
  'https://supabase.colliersdealhub.com',
  'https://services.colliersdealhub.com',
  'https://mailhub.colliersdealhub.com',
  'https://api.colliersdealhub.com',
  'http://localhost:3000'  // For local development
];

const server = http.createServer(async (req, res) => {
  // CORS handling for your domains
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Parse URL and query parameters
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Handle OPTIONS requests (for CORS)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Health check endpoint
    if (path === '/api/healthcheck') {
      console.log('Attempting health check...');
      const { data, error } = await supabase
        .from('DailyMarketReport')
        .select('count')
        .limit(1);

      if (error) {
        console.error('Health check error:', error);
        throw error;
      }

      console.log('Health check successful');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      }));
    }
    // Market data export endpoint
    else if (path === '/api/export-latest-market-data') {
      console.log('Checking database record sequence...');
      
      // First, let's get the earliest records
      const { data: earlyRecords, error: earlyError } = await supabase
        .from('DailyMarketReport')
        .select('*')
        .order('id', { ascending: true })
        .limit(10);

      if (earlyError) {
        console.error('Error fetching early records:', earlyError);
        throw earlyError;
      }

      // Then get some records around ID 50
      const { data: middleRecords, error: middleError } = await supabase
        .from('DailyMarketReport')
        .select('*')
        .gte('id', 45)
        .lte('id', 55)
        .order('id', { ascending: true });

      if (middleError) {
        console.error('Error fetching middle records:', middleError);
        throw middleError;
      }

      console.log('First 10 records in database:', JSON.stringify(earlyRecords, null, 2));
      console.log('Records around ID 50:', JSON.stringify(middleRecords, null, 2));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        earlyRecords,
        middleRecords,
        summary: {
          earliestId: earlyRecords.length > 0 ? earlyRecords[0].id : null,
          gapStart: earlyRecords.length > 0 ? earlyRecords[earlyRecords.length - 1].id + 1 : null,
          gapEnd: middleRecords.length > 0 ? middleRecords[0].id - 1 : null
        }
      }));
    }
    // Handle 404
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack
    });

    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: error.message,
      details: error.details,
      hint: error.hint,
      timestamp: new Date().toISOString()
    }));
  }
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`API server running on port ${port}`);
});
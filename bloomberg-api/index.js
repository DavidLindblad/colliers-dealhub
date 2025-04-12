require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { parse } = require('csv-parse/sync');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Bloomberg API configuration - using exact values provided
const bloombergConfig = {
  tokenEndpoint: 'https://bsso.blpprofessional.com/ext/api/as/token.oauth2',
  clientId: 'ed1b85be93ad2b60985c6edacf039aa8',
  clientSecret: '42a3cf00ca42c5d1588e9337692d54ea76d4fe48fcef251bc4bc1ed2c08f012b',
  baseUrl: 'https://api.bloomberg.com/eap/',
  catalog: '40368',
  ratesDataset: 'uhTHmsoic3s',
  cpiDataset: 'uhZ2f73GGS6Y'  // Updated CPI dataset ID
};

async function fetchAndStoreData() {
  console.log('Starting data fetch at:', new Date().toISOString());
  try {
    // Get today's date in YYYYMMDD format for snapshot
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    console.log('Using snapshot date:', today);

    // Get Bloomberg access token
    console.log('Getting Bloomberg access token...');
    const tokenResponse = await axios({
      method: 'post',
      url: bloombergConfig.tokenEndpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: 'grant_type=client_credentials' +
            '&client_id=' + bloombergConfig.clientId +
            '&client_secret=' + bloombergConfig.clientSecret
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('Access token received');

    // Fetch Rates data
    console.log('Fetching Rates data...');
    const ratesUrl = bloombergConfig.baseUrl + 
                    'catalogs/' + bloombergConfig.catalog + 
                    '/datasets/' + bloombergConfig.ratesDataset + 
                    '/snapshots/' + today + 
                    '/distributions/' + bloombergConfig.ratesDataset + '.csv';

    console.log('Requesting Rates URL:', ratesUrl);
    const ratesResponse = await axios.get(ratesUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'text/csv',
        'api-version': '2'
      }
    });

    // Remove headers
    const ratesData = ratesResponse.data.split('\\n').slice(1).join('\\n');
    console.log('Rates data received');

    // Fetch CPI data
    console.log('Fetching CPI data...');
    const cpiUrl = bloombergConfig.baseUrl + 
                   'catalogs/' + bloombergConfig.catalog + 
                   '/datasets/' + bloombergConfig.cpiDataset + 
                   '/snapshots/' + today + 
                   '/distributions/' + bloombergConfig.cpiDataset + '.csv';

    console.log('Requesting CPI URL:', cpiUrl);
    const cpiResponse = await axios.get(cpiUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'text/csv',
        'api-version': '2'
      }
    });

    // Remove headers
    const cpiData = cpiResponse.data.split('\\n').slice(1).join('\\n');
    console.log('CPI data received');

    // Parse CSV data and combine
    const combinedData = ratesData + cpiData;
    const parsedData = parse(combinedData);

    // Process and store data
    console.log('Processing and storing data in Supabase...');
    const marketData = {
      date: new Date().toISOString().split('T')[0],
      data: parsedData,
      timestamp: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from(process.env.SUPABASE_TABLE_NAME)
      .insert([marketData]);

    if (error) throw error;
    console.log('Data successfully stored:', new Date().toISOString());
  } catch (error) {
    console.error('Error in fetchAndStoreData:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Request URL:', error.response.config.url);
    }
    console.error('Full error:', error);
  }
}

// Schedule cron jobs
console.log('Setting up cron schedules...');
const schedules = [
  process.env.CRON_SCHEDULE_1,  // 8:00 AM
  process.env.CRON_SCHEDULE_2   // 8:00 PM
];

schedules.forEach((schedule, index) => {
  if (schedule) {
    console.log('Setting up cron job ' + (index + 1) + ' with schedule: ' + schedule);
    cron.schedule(schedule, fetchAndStoreData);
  }
});

// Initial fetch on startup
console.log('Performing initial data fetch...');
fetchAndStoreData();

// Keep the process running
console.log('Service started successfully');

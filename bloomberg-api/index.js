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

// Bloomberg API configuration
const bloombergConfig = {
  tokenEndpoint: 'https://bsso.blpprofessional.com/ext/api/as/token.oauth2',
  clientId: 'ed1b85be93ad2b60985c6edacf039aa8',
  clientSecret: '42a3cf00ca42c5d1588e9337692d54ea76d4fe48fcef251bc4bc1ed2c08f012b',
  baseUrl: 'https://api.bloomberg.com/eap/',
  catalog: '40368',
  ratesDataset: 'uhTHmsoic3s',
  cpiDataset: 'uhZ2f73GGS6Y',
  snapshotDate: '20250411'
};

async function fetchAndStoreData() {
  console.log('Starting data fetch at:', new Date().toISOString());
  try {
    // Get Bloomberg access token
    console.log('Getting Bloomberg access token...');
    const tokenResponse = await axios({
      method: 'post',
      url: bloombergConfig.tokenEndpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: 'grant_type=client_credentials&client_id=' + bloombergConfig.clientId + '&client_secret=' + bloombergConfig.clientSecret
    });

    const bbToken = tokenResponse.data.access_token;
    console.log('Access token received');

    // Fetch Rates data
    const ratesUrl = bloombergConfig.baseUrl + 
                    'catalogs/' + bloombergConfig.catalog + 
                    '/datasets/' + bloombergConfig.ratesDataset + 
                    '/snapshots/' + bloombergConfig.snapshotDate + 
                    '/distributions/' + bloombergConfig.ratesDataset + '.csv';

    console.log('Requesting Rates URL:', ratesUrl);
    const ratesResponse = await axios.get(ratesUrl, {
      headers: {
        'Authorization': 'Bearer ' + bbToken,
        'Accept': 'text/csv',
        'api-version': '2'
      }
    });

    let bbData1 = ratesResponse.data;
    bbData1 = bbData1.substring(bbData1.indexOf('\\n') + 1);
    console.log('Rates data received and processed');

    // Fetch CPI data
    const cpiUrl = bloombergConfig.baseUrl + 
                   'catalogs/' + bloombergConfig.catalog + 
                   '/datasets/' + bloombergConfig.cpiDataset + 
                   '/snapshots/' + bloombergConfig.snapshotDate + 
                   '/distributions/' + bloombergConfig.cpiDataset + '.csv';

    console.log('Requesting CPI URL:', cpiUrl);
    const cpiResponse = await axios.get(cpiUrl, {
      headers: {
        'Authorization': 'Bearer ' + bbToken,
        'Accept': 'text/csv',
        'api-version': '2'
      }
    });

    let bbData2 = cpiResponse.data;
    bbData2 = bbData2.substring(bbData2.indexOf('\\n') + 1);
    console.log('CPI data received and processed');

    // Parse the CSV data to get the values we need
    const now = new Date();
    const marketData = {
      DL_REQUEST_ID: bloombergConfig.ratesDataset,  // Using rates dataset ID
      DL_REQUEST_NAME: 'Bloomberg Market Data',
      DL_SNAPSHOT_TZ: 'UTC',
      IDENTIFIER: 'RATES_AND_CPI',
      RC: 0,  // Success code
      Date: now.toISOString().split('T')[0],  // Current date in YYYY-MM-DD format
      PX_LAST: bbData1,  // Storing rates data in PX_LAST
      DL_SNAPSHOT_START_TIME: now.toISOString()  // Current timestamp with timezone
    };

    console.log('Attempting to insert with structure:', JSON.stringify(marketData, null, 2));

    const { data, error } = await supabase
      .from('DailyMarketReport')
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
  process.env.CRON_SCHEDULE_1,
  process.env.CRON_SCHEDULE_2
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

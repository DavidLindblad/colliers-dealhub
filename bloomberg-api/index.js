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

// Bloomberg API configuration - matching VBA implementation
const bloombergConfig = {
  tokenEndpoint: 'https://bsso.blpprofessional.com/ext/api/as/token.oauth2',
  clientId: process.env.BLOOMBERG_CLIENT_ID,
  clientSecret: process.env.BLOOMBERG_CLIENT_SECRET,
  baseUrl: 'https://api.bloomberg.com/eap/',
  catalog: '40368'
};

async function fetchAndStoreData() {
  console.log('Starting data fetch at:', new Date().toISOString());
  try {
    // Get Bloomberg access token - matching VBA implementation
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

    // Get today's date in YYYYMMDD format
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Fetch Rates data - matching VBA implementation
    console.log('Fetching Rates data...');
    const ratesUrl = bloombergConfig.baseUrl + 
                    'catalogs/' + bloombergConfig.catalog + 
                    '/datasets/' + process.env.BLOOMBERG_RATES_DATASET + 
                    '/snapshots/' + today + 
                    '/distributions/' + process.env.BLOOMBERG_RATES_DATASET + '.csv';

    const ratesResponse = await axios.get(ratesUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'text/csv'
      }
    });

    console.log('Rates data received');

    // Fetch CPI data - matching VBA implementation
    console.log('Fetching CPI data...');
    const cpiUrl = bloombergConfig.baseUrl + 
                   'catalogs/' + bloombergConfig.catalog + 
                   '/datasets/' + process.env.BLOOMBERG_CPI_DATASET + 
                   '/snapshots/' + today + 
                   '/distributions/' + process.env.BLOOMBERG_CPI_DATASET + '.csv';

    const cpiResponse = await axios.get(cpiUrl, {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept': 'text/csv'
      }
    });

    console.log('CPI data received');

    // Parse CSV data (removing headers like in VBA)
    const ratesData = parse(ratesResponse.data.split('\\n').slice(1).join('\\n'));
    const cpiData = parse(cpiResponse.data.split('\\n').slice(1).join('\\n'));

    // Process and store data
    console.log('Processing and storing data in Supabase...');
    const marketData = {
      date: new Date().toISOString().split('T')[0],
      rates_data: ratesData,
      cpi_data: cpiData,
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

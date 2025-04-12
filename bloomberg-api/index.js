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

// Bloomberg API configuration - matching VBA implementation exactly
const bloombergConfig = {
  tokenEndpoint: 'https://bsso.blpprofessional.com/ext/api/as/token.oauth2',
  clientId: process.env.BLOOMBERG_CLIENT_ID,
  clientSecret: process.env.BLOOMBERG_CLIENT_SECRET,
  baseUrl: 'https://api.bloomberg.com/eap/catalogs/40368/datasets/',  // Updated to match VBA exactly
  apiVersion: '2'
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

    // Common headers for Bloomberg API requests
    const bloombergHeaders = {
      'Authorization': 'Bearer ' + accessToken,
      'Accept': 'text/csv',
      'api-version': bloombergConfig.apiVersion
    };

    // Fetch Rates data - exactly matching VBA URL structure
    console.log('Fetching Rates data...');
    const ratesUrl = bloombergConfig.baseUrl + 
                    process.env.BLOOMBERG_RATES_DATASET + 
                    '/snapshots/' + today + 
                    '/distributions/' + process.env.BLOOMBERG_RATES_DATASET + '.csv';

    console.log('Requesting Rates URL:', ratesUrl);
    const ratesResponse = await axios.get(ratesUrl, {
      headers: bloombergHeaders,
      validateStatus: function (status) {
        return status < 500; // Accept any status code less than 500
      }
    });

    if (ratesResponse.status !== 200) {
      console.error('Rates API Error:', ratesResponse.data);
      throw new Error('Failed to fetch rates data: ' + ratesResponse.data.description);
    }

    console.log('Rates data received');

    // Fetch CPI data - exactly matching VBA URL structure
    console.log('Fetching CPI data...');
    const cpiUrl = bloombergConfig.baseUrl + 
                   process.env.BLOOMBERG_CPI_DATASET + 
                   '/snapshots/' + today + 
                   '/distributions/' + process.env.BLOOMBERG_CPI_DATASET + '.csv';

    console.log('Requesting CPI URL:', cpiUrl);
    const cpiResponse = await axios.get(cpiUrl, {
      headers: bloombergHeaders,
      validateStatus: function (status) {
        return status < 500; // Accept any status code less than 500
      }
    });

    if (cpiResponse.status !== 200) {
      console.error('CPI API Error:', cpiResponse.data);
      throw new Error('Failed to fetch CPI data: ' + cpiResponse.data.description);
    }

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

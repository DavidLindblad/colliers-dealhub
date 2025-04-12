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
  endpoint: process.env.BLOOMBERG_API_ENDPOINT,
  clientId: process.env.BLOOMBERG_CLIENT_ID,
  clientSecret: process.env.BLOOMBERG_CLIENT_SECRET,
  ratesDataset: process.env.BLOOMBERG_RATES_DATASET,
  cpiDataset: process.env.BLOOMBERG_CPI_DATASET,
  dataLicenseUrl: 'https://api.bloomberg.com/eap/catalogs/bbg/datasets'
};

// Create axios instance with custom config
const bloombergAxios = axios.create({
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

async function fetchAndStoreData() {
  console.log('Starting data fetch at:', new Date().toISOString());
  try {
    // Get Bloomberg access token
    console.log('Getting Bloomberg access token...');
    const tokenResponse = await axios({
      method: 'post',
      url: bloombergConfig.endpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: bloombergConfig.clientId,
        password: bloombergConfig.clientSecret
      },
      data: 'grant_type=client_credentials'
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('Access token received');

    // Set token in axios instance
    bloombergAxios.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;

    // Fetch Rates data
    console.log('Fetching Rates data...');
    const ratesUrl = bloombergConfig.dataLicenseUrl + '/' + bloombergConfig.ratesDataset + '/data';
    const ratesResponse = await bloombergAxios.get(ratesUrl, {
      params: {
        format: 'json'
      }
    });

    console.log('Rates data received:', ratesResponse.data);

    // Fetch CPI data
    console.log('Fetching CPI data...');
    const cpiUrl = bloombergConfig.dataLicenseUrl + '/' + bloombergConfig.cpiDataset + '/data';
    const cpiResponse = await bloombergAxios.get(cpiUrl, {
      params: {
        format: 'json'
      }
    });

    console.log('CPI data received:', cpiResponse.data);

    // Process and store data
    console.log('Processing and storing data in Supabase...');
    const marketData = {
      date: new Date().toISOString().split('T')[0],
      rates_data: ratesResponse.data,
      cpi_data: cpiResponse.data,
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

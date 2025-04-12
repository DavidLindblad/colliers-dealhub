require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
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
  cpiDataset: process.env.BLOOMBERG_CPI_DATASET
};

async function fetchAndStoreData() {
  console.log('Starting data fetch at:', new Date().toISOString());
  try {
    // Fetch data from Bloomberg
    console.log('Fetching data from Bloomberg...');
    const response = await axios({
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

    console.log('Bloomberg API response:', response.data);

    // Parse and store data
    console.log('Parsing and storing data in Supabase...');
    const { data, error } = await supabase
      .from(process.env.SUPABASE_TABLE_NAME)
      .insert([response.data]);

    if (error) throw error;
    console.log('Data successfully stored:', new Date().toISOString());
  } catch (error) {
    console.error('Error in fetchAndStoreData:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
      console.error('Status:', error.response.status);
    }
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

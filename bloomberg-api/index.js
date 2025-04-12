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

// Equivalent to VBA's APICall function
async function apiCall(method, body, url, contentType, apiVersion, token, description) {
  console.log(\Making API call for \...\);
  console.log('URL:', url);
  
  try {
    const response = await axios({
      method: method,
      url: url,
      data: body,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'text/csv',
        'api-version': apiVersion,
        ...(contentType && { 'Content-Type': contentType })
      }
    });
    
    console.log(\\ API call successful\);
    return response.data;
  } catch (error) {
    console.error(\Error in \ API call:\, error.message);
    throw error;
  }
}

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
      data: \grant_type=client_credentials&client_id=\&client_secret=\\
    });

    const bbToken = tokenResponse.data.access_token;
    console.log('Access token received');

    // Fetch Rates data - exactly matching VBA implementation
    const ratesUrl = bloombergConfig.baseUrl + 
                    'catalogs/' + bloombergConfig.catalog + 
                    '/datasets/' + bloombergConfig.ratesDataset + 
                    '/snapshots/' + bloombergConfig.snapshotDate + 
                    '/distributions/' + bloombergConfig.ratesDataset + '.csv';

    // Equivalent to: BBData1 = APICall("GET", "", reqURL, "", "2", BBToken, "BB Rates")
    let bbData1 = await apiCall('GET', '', ratesUrl, '', '2', bbToken, 'BB Rates');
    
    // Equivalent to: BBData1 = Mid(BBData1, InStr(BBData1, vbLf) + 1)
    bbData1 = bbData1.substring(bbData1.indexOf('\\n') + 1);
    console.log('Rates data processed');

    // Fetch CPI data - exactly matching VBA implementation
    const cpiUrl = bloombergConfig.baseUrl + 
                   'catalogs/' + bloombergConfig.catalog + 
                   '/datasets/' + bloombergConfig.cpiDataset + 
                   '/snapshots/' + bloombergConfig.snapshotDate + 
                   '/distributions/' + bloombergConfig.cpiDataset + '.csv';

    // Equivalent to: BBData2 = APICall("GET", "", reqURL, "", "2", BBToken, "BB CPI")
    let bbData2 = await apiCall('GET', '', cpiUrl, '', '2', bbToken, 'BB CPI');
    
    // Equivalent to: BBData2 = Mid(BBData2, InStr(BBData2, vbLf) + 1)
    bbData2 = bbData2.substring(bbData2.indexOf('\\n') + 1);
    console.log('CPI data processed');

    // Combine and parse the data
    const combinedData = bbData1 + bbData2;
    const parsedData = parse(combinedData);

    // Store in Supabase
    console.log('Storing data in Supabase...');
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

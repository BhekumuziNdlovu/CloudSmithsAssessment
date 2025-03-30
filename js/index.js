require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables
const {
  SALESFORCE_CONSUMER_KEY,
  SALESFORCE_CONSUMER_SECRET,
  SALESFORCE_USERNAME,
  SALESFORCE_PASSWORD,
  SALESFORCE_INSTANCE_URL,
  CALENDARIFIC_API_KEY,
} = process.env;

let accessToken = null;

// Middleware to parse JSON
app.use(express.json());

// Endpoint to authenticate with Salesforce
app.post("/api/authenticate", async (req, res) => {
  try {
    const response = await axios.post(
      "https://login.salesforce.com/services/oauth2/token",
      new URLSearchParams({
        grant_type: "password",
        client_id: SALESFORCE_CONSUMER_KEY,
        client_secret: SALESFORCE_CONSUMER_SECRET,
        username: SALESFORCE_USERNAME,
        password: SALESFORCE_PASSWORD,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const data = response.data;
    if (data.access_token) {
      accessToken = data.access_token;
      res.json({ success: true, access_token: accessToken });
    } else {
      res.status(400).json({ error: "Authentication failed" });
    }
  } catch (error) {
    console.error("Error authenticating with Salesforce:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint to save ID number details to Salesforce
app.post("/api/save-id", async (req, res) => {
  const { idNumber, dateOfBirth, gender, citizenshipStatus } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: "Not authenticated with Salesforce" });
  }

  const record = {
    Name: idNumber,
    Date_Of_Birth__c: dateOfBirth,
    Gender__c: gender,
    Citizenship_Status__c: citizenshipStatus,
    Search_Count__c: 1,
  };

  try {
    // Check if the record already exists
    const queryResponse = await axios.get(
      `${SALESFORCE_INSTANCE_URL}/services/data/v57.0/query/?q=SELECT Id, Search_Count__c FROM Identification_Number__c WHERE Name='${idNumber}'`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (queryResponse.data.totalSize > 0) {
      // Update existing record
      const recordId = queryResponse.data.records[0].Id;
      const currentCount = queryResponse.data.records[0].Search_Count__c || 0;

      await axios.patch(
        `${SALESFORCE_INSTANCE_URL}/services/data/v57.0/sobjects/Identification_Number__c/${recordId}`,
        { Search_Count__c: currentCount + 1 },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // Create new record
      await axios.post(
        `${SALESFORCE_INSTANCE_URL}/services/data/v57.0/sobjects/Identification_Number__c`,
        record,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving ID number details:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint to fetch public holidays using Calendarific API
app.post("/api/fetch-holidays", async (req, res) => {
  const { year } = req.body;

  try {
    const response = await axios.get(
      `https://calendarific.com/api/v2/holidays?api_key=${CALENDARIFIC_API_KEY}&country=ZA&year=${year}`
    );

    if (response.data.response && response.data.response.holidays) {
      res.json({ success: true, holidays: response.data.response.holidays });
    } else {
      res.status(400).json({ error: "Invalid holiday data received" });
    }
  } catch (error) {
    console.error("Error fetching public holidays:", error.response?.data || error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend proxy listening on port ${PORT}`);
});
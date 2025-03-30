document.addEventListener("DOMContentLoaded", () => {
  const idNumberInput = document.getElementById("id-number");
  const searchButton = document.getElementById("search-button");
  const errorMessage = document.getElementById("error-message");

  // Hardcoded Salesforce credentials (replace with environment variables in production)
  const consumerKey = "3MVG9dAEux2v1sLsqWAfLpFp3SJyFNz4y7qVsg7IaLJloJwF51QQsy_x51ZHGudNl42qTlHdxWcbnuYpBxpRK";
  const consumerSecret = "9DF9117D3D2D995F7E83C8CE375B4C6ADB903BECEABE8A67A0F9B435419474F0";
  const username = "muzinkosi70468@agentforce.com";
  const password = "NOmxolisi08#"; // Ensure this includes the security token if required
  const salesforceInstanceUrl = "https://orgfarm-865b3e1da5-dev-ed.develop.my.salesforce.com"; // Your Salesforce instance URL

  let accessToken = localStorage.getItem("salesforceAccessToken"); // Retrieve access token from storage

  // Function to validate ID number
  function validateIDNumber(idNumber) {
    // Check length and numeric format
    if (idNumber.length !== 13 || !/^\d+$/.test(idNumber)) {
      return "ID number must be exactly 13 numeric digits.";
    }

    // Extract date of birth (YYMMDD)
    const year = parseInt(idNumber.substring(0, 2), 10);
    const month = parseInt(idNumber.substring(2, 4), 10);
    const day = parseInt(idNumber.substring(4, 6), 10);

    // Validate month and day ranges
    if (month < 1 || month > 12) return "Invalid month in ID number.";
    if (day < 1 || day > 31) return "Invalid day in ID number.";

    // Determine century (people born after 2000 have IDs starting with 00-21)
    const currentYear = new Date().getFullYear();
    const currentShortYear = currentYear % 100;
    const fullYear = year <= currentShortYear ? 2000 + year : 1900 + year;

    // Validate the actual date
    const dateOfBirth = new Date(fullYear, month - 1, day);

    // Check if date is invalid
    if (isNaN(dateOfBirth.getTime())) {
      return "Invalid date of birth in ID number.";
    }

    // Additional validation to ensure date wasn't adjusted
    if (dateOfBirth.getDate() !== day || 
        dateOfBirth.getMonth() + 1 !== month || 
        dateOfBirth.getFullYear() !== fullYear) {
      return "Invalid date of birth in ID number.";
    }

    // Validate gender (7th digit)
    const genderDigit = parseInt(idNumber[6], 10);
    if (genderDigit < 0 || genderDigit > 9) {
      return "Invalid gender indicator in ID number.";
    }

    // Validate citizenship status (11th digit)
    const citizenshipDigit = parseInt(idNumber[10], 10);
    if (![0, 1].includes(citizenshipDigit)) {
      return "Invalid citizenship status in ID number.";
    }

    // Validate checksum using Luhn algorithm
    if (!luhnCheck(idNumber)) {
      return "Invalid checksum in ID number.";
    }

    return null; // No errors
  }

  // Luhn algorithm for checksum validation
  function luhnCheck(idNumber) {
    let sum = 0;
    for (let i = 0; i < idNumber.length; i++) {
      let digit = parseInt(idNumber[i], 10);
      if ((idNumber.length - i) % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  // Function to authenticate with Salesforce programmatically
  async function authenticateWithSalesforce() {
    try {
      // Use a proxy server to handle CORS issues
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const targetUrl = "https://login.salesforce.com/services/oauth2/token";
      
      const response = await fetch(proxyUrl + targetUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: new URLSearchParams({
          grant_type: "password",
          client_id: consumerKey,
          client_secret: consumerSecret,
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        accessToken = data.access_token;
        localStorage.setItem("salesforceAccessToken", accessToken); // Store access token securely
        console.log("Access Token:", accessToken);
        alert("Authentication successful!");
      } else {
        console.error("Error during authentication:", data);
        alert("Authentication failed. Please check the console for details.");
      }
    } catch (error) {
      console.error("Error authenticating with Salesforce:", error);
      alert("Authentication failed. Please check the console for details.");
    }
  }

  // Function to save ID number details to Salesforce
  async function saveIDNumberDetails(idNumber, dateOfBirth, gender, citizenshipStatus) {
    if (!accessToken) {
      alert("Not authenticated with Salesforce. Authenticating now...");
      await authenticateWithSalesforce(); // Authenticate if no access token is present
      if (!accessToken) return; // If authentication still failed, exit
    }

    const record = {
      Name: idNumber, // Identification Number
      Date_Of_Birth__c: dateOfBirth.toISOString().split("T")[0], // Format as YYYY-MM-DD
      Gender__c: gender,
      Citizenship_Status__c: citizenshipStatus,
      Search_Count__c: 1,
    };

    try {
      // Use a proxy server to handle CORS issues
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      
      // Check if the record already exists
      const queryUrl = `${salesforceInstanceUrl}/services/data/v57.0/query/?q=SELECT+Id,Search_Count__c+FROM+Identification_Number__c+WHERE+Name='${idNumber}'`;
      
      const queryResponse = await fetch(
        proxyUrl + queryUrl,
        {
          method: "GET",
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "Accept": "application/json"
          },
        }
      );

      const queryData = await queryResponse.json();

      if (queryData.totalSize > 0) {
        // Record exists, update the search count
        const recordId = queryData.records[0].Id;
        const currentCount = queryData.records[0].Search_Count__c || 0;

        await fetch(
          proxyUrl + `${salesforceInstanceUrl}/services/data/v57.0/sobjects/Identification_Number__c/${recordId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({ Search_Count__c: currentCount + 1 }),
          }
        );
      } else {
        // Record does not exist, create a new one
        record.Search_Count__c = 1;

        await fetch(
          proxyUrl + `${salesforceInstanceUrl}/services/data/v57.0/sobjects/Identification_Number__c`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(record),
          }
        );
      }

      alert("ID Number details saved successfully!");

      // Fetch public holidays after saving ID number details
      const year = parseInt(idNumber.substring(0, 2), 10);
      const currentYear = new Date().getFullYear();
      const currentShortYear = currentYear % 100;
      const fullYear = year <= currentShortYear ? 2000 + year : 1900 + year;
      await fetchPublicHolidays(fullYear);
    } catch (error) {
      console.error("Error saving ID number details:", error);
      alert("Failed to save ID details to Salesforce.");
    }
  }

  // Function to fetch public holidays using Calendarific API
  async function fetchPublicHolidays(year) {
    const apiKey = "24c5e86734eb44dc4a962826324a5546e74dc42f";
    const countryCode = "ZA";

    try {
      // Use a proxy server to handle CORS issues
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const targetUrl = `https://calendarific.com/api/v2/holidays?api_key=${apiKey}&country=${countryCode}&year=${year}`;
      
      const response = await fetch(proxyUrl + targetUrl, {
        headers: {
          "Accept": "application/json"
        }
      });

      const data = await response.json();
      const holidays = data.response.holidays;

      console.log("Public Holidays:", holidays);

      // Display holidays on the webpage
      displayHolidays(holidays);
    } catch (error) {
      console.error("Error fetching public holidays:", error);
      alert("Failed to fetch public holidays.");
    }
  }

  // Function to display holidays on the webpage
  function displayHolidays(holidays) {
    const holidaysSection = document.getElementById("holidays-section");
    holidaysSection.innerHTML = "";

    holidays.forEach((holiday) => {
      const holidayItem = document.createElement("div");
      holidayItem.textContent = `${holiday.name} (${holiday.date.iso})`;
      holidaysSection.appendChild(holidayItem);
    });
  }

  // Event listener for input changes
  idNumberInput.addEventListener("input", () => {
    const idNumber = idNumberInput.value.trim();

    // Only validate if we have 13 characters (don't show errors while typing)
    if (idNumber.length === 13) {
      const error = validateIDNumber(idNumber);

      if (error) {
        errorMessage.textContent = error;
        errorMessage.style.color = "red";
        searchButton.disabled = true;
      } else {
        errorMessage.textContent = "Valid ID number";
        errorMessage.style.color = "green";
        searchButton.disabled = false;
      }
    } else {
      errorMessage.textContent = "";
      searchButton.disabled = true;
    }
  });

  // Event listener for search button click
  searchButton.addEventListener("click", async () => {
    const idNumber = idNumberInput.value.trim();

    // Validate the ID number again before saving
    const error = validateIDNumber(idNumber);

    if (error) {
      errorMessage.textContent = error;
      errorMessage.style.color = "red";
      searchButton.disabled = true;
      return;
    }

    // Decode ID number details
    const year = parseInt(idNumber.substring(0, 2), 10);
    const month = parseInt(idNumber.substring(2, 4), 10);
    const day = parseInt(idNumber.substring(4, 6), 10);
    const currentYear = new Date().getFullYear();
    const currentShortYear = currentYear % 100;
    const fullYear = year <= currentShortYear ? 2000 + year : 1900 + year;
    const dateOfBirth = new Date(fullYear, month - 1, day);

    const genderDigit = parseInt(idNumber[6], 10);
    const gender = genderDigit < 5 ? "Female" : "Male";

    const citizenshipDigit = parseInt(idNumber[10], 10);
    const citizenshipStatus = citizenshipDigit === 0 ? "SA Citizen" : "Permanent Resident";

    // Save details to Salesforce
    await saveIDNumberDetails(idNumber, dateOfBirth, gender, citizenshipStatus);
  });

  // Authenticate with Salesforce on page load if no access token is stored
  if (!accessToken) {
    authenticateWithSalesforce();
  }
});
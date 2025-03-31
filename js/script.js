document.addEventListener("DOMContentLoaded", () => {
  const idNumberInput = document.getElementById("id-number");
  const searchButton = document.getElementById("search-button");
  const errorMessage = document.getElementById("error-message");
  const successMessage = document.getElementById("success-message");

  // Hardcoded Salesforce credentials
  const consumerKey = "3MVG9dAEux2v1sLsqWAfLpFp3SJyFNz4y7qVsg7IaLJloJwF51QQsy_x51ZHGudNl42qTlHdxWcbnuYpBxpRK";
  const consumerSecret = "9DF9117D3D2D995F7E83C8CE375B4C6ADB903BECEABE8A67A0F9B435419474F0";
  const username = "muzinkosi70468@agentforce.com";
  const password = "NOmxolisi08#gH6ssKV21Z9tlMweYMOic4j0";
  const salesforceInstanceUrl = "https://orgfarm-865b3e1da5-dev-ed.develop.my.salesforce.com";

  let accessToken = localStorage.getItem("salesforceAccessToken");
  console.log(accessToken);

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

  // Salesforce authentication function
  async function authenticateWithSalesforce() {
    try {
      const response = await fetch("https://login.salesforce.com/services/oauth2/token", {
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
      console.log(data);

      if (data.access_token) {
        accessToken = data.access_token;
        localStorage.setItem("salesforceAccessToken", accessToken);
        console.log("Authentication successful");
        return true;
      } else {
        console.error("Authentication error:", data);
        errorMessage.textContent = "Authentication failed. Please try again.";
        errorMessage.style.color = "red";
        return false;
      }
    } catch (error) {
      console.error("Authentication failed:", error);
      errorMessage.textContent = "Authentication error. Please check console.";
      errorMessage.style.color = "red";
      return false;
    }
  }

  // Function to save ID number details to Salesforce
  async function saveIDNumberDetails(idNumber, dateOfBirth, gender, citizenshipStatus) {
    if (!accessToken && !(await authenticateWithSalesforce())) {
      errorMessage.textContent = "Authentication failed. Cannot save data.";
      errorMessage.style.color = "red";
      return;
    }

    // Prepare the record according to your custom object fields
    const dateOnly = dateOfBirth.toISOString().split('T')[0];
    const record = {
      Name: idNumber, // Identification_Number__c.Name field
      Date_Of_Birth__c: dateOnly,
      Gender__c: gender,
      Citizenship_Status__c: citizenshipStatus,
      Search_Count__c: 1
    };

    try {
      // Check if the record already exists
      const queryResponse = await fetch(
        `${salesforceInstanceUrl}/services/data/v57.0/query/?q=SELECT+Id,Search_Count__c+FROM+Identification_Number__c+WHERE+Name='${idNumber}'`,
        {
          method: "GET",
          headers: { 
            Authorization: `Bearer ${accessToken}`,
            "Accept": "application/json"
          }
        }
      );

      const queryData = await queryResponse.json();

      if (queryData.totalSize > 0) {
        // Update existing record
        const recordId = queryData.records[0].Id;
        const currentCount = queryData.records[0].Search_Count__c || 0;

        await fetch(
          `${salesforceInstanceUrl}/services/data/v57.0/sobjects/Identification_Number__c/${recordId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({ Search_Count__c: currentCount + 1 })
          }
        );
      } else {
        // Create new record
        await fetch(
          `${salesforceInstanceUrl}/services/data/v57.0/sobjects/Identification_Number__c`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(record)
          }
        );
      }
      console.log( JSON.stringify(record));
      successMessage.textContent = "ID details saved successfully!";
      successMessage.style.color = "green";
      

      // Fetch public holidays for the extracted year
      const year = dateOfBirth.getFullYear();
      await fetchPublicHolidays(year);
    } catch (error) {
      console.error("Error saving ID details:", error);
      errorMessage.textContent = "Failed to save ID details. Please try again.";
      errorMessage.style.color = "red";
    }
  }

  // Function to fetch public holidays using Calendarific API
  async function fetchPublicHolidays(year) {
    const apiKey = "24c5e86734eb44dc4a962826324a5546e74dc42f";
    const countryCode = "ZA";

    try {
      const targetUrl = `https://calendarific.com/api/v2/holidays?api_key=${apiKey}&country=${countryCode}&year=${year}`;
      const response = await fetch(targetUrl, {
        headers: { 
          "Accept": "application/json"
        }
      });

      const data = await response.json();

      if (data.response && data.response.holidays) {
        displayHolidays(data.response.holidays);
      } else {
        throw new Error("Invalid holiday data received");
      }
    } catch (error) {
      console.error("Error fetching public holidays:", error);
      errorMessage.textContent = "Failed to fetch public holidays.";
      errorMessage.style.color = "red";
    }
  }

  // Function to display holidays on the webpage
  function displayHolidays(holidays) {
    const holidaysSection = document.getElementById("holidays-section");
    holidaysSection.innerHTML = "<h3>Public Holidays in Your Birth Year:</h3>";

    if (holidays.length === 0) {
      holidaysSection.innerHTML += "<p>No public holidays found for this year.</p>";
      return;
    }

    const holidayList = document.createElement("ul");
    holidays.forEach((holiday) => {
      const holidayItem = document.createElement("li");
      holidayItem.textContent = `${holiday.name} - ${holiday.date.iso}`;
      holidayList.appendChild(holidayItem);
    });

    holidaysSection.appendChild(holidayList);
  }

  // Event listener for input changes
  idNumberInput.addEventListener("input", () => {
    const idNumber = idNumberInput.value.trim();

    if (idNumber.length === 13) {
      const error = validateIDNumber(idNumber);

      if (error) {
        errorMessage.textContent = error;
        errorMessage.style.color = "red";
        searchButton.disabled = true;
      } else {
        successMessage.textContent = "Valid ID number";
        successMessage.style.color = "green";
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

    const error = validateIDNumber(idNumber);
    if (error) {
      errorMessage.textContent = error;
      errorMessage.style.color = "red";
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

  // Initial authentication
  if (!accessToken) {
    authenticateWithSalesforce();
  }
});
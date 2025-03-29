document.addEventListener("DOMContentLoaded", () => {
  const idNumberInput = document.getElementById("id-number");
  const searchButton = document.getElementById("search-button");
  const errorMessage = document.getElementById("error-message");

  // Function to validate ID number
  function validateIDNumber(idNumber) {
    // Check length
    if (idNumber.length !== 13 || !/^\d+$/.test(idNumber)) {
      return "ID number must be exactly 13 numeric digits.";
    }

    // Extract date of birth (YYMMDD)
    const year = parseInt(idNumber.substring(0, 2), 10);
    const month = parseInt(idNumber.substring(2, 4), 10);
    const day = parseInt(idNumber.substring(4, 6), 10);

    // Validate month and day ranges before constructing the Date object
    if (month < 1 || month > 12) {
      return "Invalid month in ID number.";
    }
    if (day < 1 || day > 31) {
      return "Invalid day in ID number.";
    }

    // Construct the date of birth (assuming 1900s)
    const dateOfBirth = new Date(`19${year}`, month - 1, day);

    // Validate date of birth
    if (
      dateOfBirth.getFullYear() !== 1900 + year ||
      dateOfBirth.getMonth() + 1 !== month ||
      dateOfBirth.getDate() !== day
    ) {
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

  // Event listener for input changes
  idNumberInput.addEventListener("input", () => {
    const idNumber = idNumberInput.value.trim();
    const error = validateIDNumber(idNumber);

    if (error) {
      errorMessage.textContent = error;
      searchButton.disabled = true;
    } else {
      errorMessage.textContent = "";
      searchButton.disabled = false;
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const idNumberInput = document.getElementById("id-number");
  const searchButton = document.getElementById("search-button");

  // Enable the search button only if the input has exactly 13 digits
  idNumberInput.addEventListener("input", () => {
    const idNumber = idNumberInput.value.trim();
    const isValidLength = idNumber.length === 13 && /^\d+$/.test(idNumber); // Check for numeric input

    searchButton.disabled = !isValidLength;
  });
});
// Convert a date string to a Date object
// example input: "08/01/2021 08:00 AM"
const formatDate = (dateString: string) => {
  try {
    // Handle different possible formats
    const parts = dateString.split(" ");

    // Handle case where there might be seconds in the time part
    if (parts.length >= 3) {
      const datePart = parts[0];
      let timePart = parts[1];
      let ampm = parts[2];

      // If time has seconds, remove them
      if (timePart.split(":").length > 2) {
        timePart = timePart.split(":").slice(0, 2).join(":");
      }

      const [month, day, year] = datePart.split("/").map(Number);
      let [hour, minute] = timePart.split(":").map(Number);

      // Convert to 24-hour format
      if (ampm === "PM" && hour < 12) {
        hour += 12;
      } else if (ampm === "AM" && hour === 12) {
        hour = 0;
      }

      // Create a Date object in UTC
      return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    }

    // Fallback for invalid format
    return new Date();
  } catch (e) {
    console.error("Error parsing date:", e);
    return new Date();
  }
};

// Get the current time in the format HH:MM:SS
// example output: "12:30:45"
const getCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

// Countdown timer
// example input: "2021-08-01T12:00:00Z" (UTC)
// example output: "5d 3h 20m 10s"
const countdown = (utcDateString: string | number | Date) => {
  // Both dates will be in the user's local timezone
  const now = new Date();
  const targetDate = new Date(utcDateString);

  const timeDiffMs = targetDate.getTime() - now.getTime();

  // Rest of your countdown calculation remains the same
  const days = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiffMs % (1000 * 60)) / 1000);

  if (timeDiffMs < 0) return "00d 00h 00m 00s";

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

// Convert UTC date to local timezone for display
// example input: "2021-08-01T12:00:00Z" (UTC) -> "08/01/2021 08:00 AM" (local)
const convertToLocalTime = (utcDateString: string | number | Date) => {
  const date = new Date(utcDateString);

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert to 12-hour format

  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
};

// Convert local date to UTC for storage
// example input: "08/01/2021 08:00 AM" (local) -> "2021-08-01T12:00:00Z" (UTC)
const convertToUTC = (dateString: string) => {
  // Parse the user input (MM/DD/YYYY HH:MM AM/PM format)
  const [datePart, timePart, ampm] = dateString.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  let [hour, minute] = timePart.split(":").map(Number);

  // Convert to 24-hour format
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  // Create a UTC date object
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0)
  ).toISOString();
};

// Get the current date and time in the format MM/DD/YYYY HH:MM AM/PM
// example output: "08/01/2021 08:00 AM"
function getCurrentDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();

  // Format time manually to ensure HH:MM format without seconds
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const formattedHours = String(hours).padStart(2, "0");

  return `${month}/${day}/${year} ${formattedHours}:${minutes} ${ampm}`;
}

export {
  formatDate,
  getCurrentDate,
  getCurrentTime,
  countdown,
  convertToLocalTime,
  convertToUTC,
};

// TODO : Refactor and remove unused code \ functions

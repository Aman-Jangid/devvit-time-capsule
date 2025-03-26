/**
 * Format a date string to a Date object
 * @param {string} dateString - The date string to format
 * @returns {Date} The formatted date
 * @example
 * formatDate("2021-07-01T00:00:00"); // Date object
 */
const formatDate = (dateString: string) => {
  try {
    return new Date(dateString.replace("AM", " AM").replace("PM", " PM"));
  } catch (error) {
    console.error("Error formatting date:", error);
    throw new Error("Invalid date format");
  }
};

/**
 * Get the current time in the format HH:MM:SS
 * @returns {string} The current time
 * @example
 * getCurrentTime(); // 12:00:00
 */
const getCurrentTime = () => {
  // countdown to reveal date (YYYY-MM-DD HH:MM:SS)
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Compare two dates
 * @param {Date} dateA - The first date
 * @param {Date} dateB - The second date
 * @returns {number} The difference in milliseconds between the two dates
 * @example
 * compareDates(new Date("2021-07-01T00:00:00"), new Date("2021-07-02T00:00:00")); // 86400000
 */
const compareDates = (dateA: Date, dateB: Date) => {
  const date1 = new Date(dateA);
  const date2 = new Date(dateB);

  const timeDiffMs = date2.getTime() - date1.getTime();

  return timeDiffMs;
};

/**
 * Countdown to a specific date
 * @param {Date} date - The date to countdown to
 * @returns {string} The countdown in the format "X days X hours X minutes X seconds"
 * @example
 * countdown(new Date("2021-07-01T00:00:00")); // 5d 12h 30m 15s
 */
const countdown = (date: Date) => {
  // countdown to reveal date (YYYY-MM-DD HH:MM:SS)
  const now = new Date();
  const timeDiffMs = new Date(date).getTime() - now.getTime();
  const days = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeDiffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiffMs % (1000 * 60)) / 1000);

  // no negative countdown
  if (timeDiffMs < 0) {
    return "00d 00h 00m 00s";
  }

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

// write jsdoc
/**
 * Get the current date and time in the format MM/DD/YYYY HH:MM:SS AM/PM
 * @returns {string} The current date and time
 * @example
 * getCurrentDate(); // 07/01/2021 12:00:00 AM
 */
function getCurrentDate() {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, "0"); // Get month (0-11, so add 1)
  const day = String(now.getDate()).padStart(2, "0"); // Get day
  const year = now.getFullYear(); // Get year
  const time = now.toLocaleTimeString("en-US", options); // Get time in 12-hour format with AM/PM

  return `${month}/${day}/${year} ${time}`;
}

export { formatDate, getCurrentDate, getCurrentTime, compareDates, countdown };

// TODO : Refactor and remove unused code \ functions

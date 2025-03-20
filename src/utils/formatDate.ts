const formatDate = (dateString: string) => {
  try {
    return new Date(dateString.replace("AM", " AM").replace("PM", " PM"));
  } catch (error) {
    console.error("Error formatting date:", error);
    throw new Error("Invalid date format");
  }
};

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

export { formatDate, getCurrentDate };

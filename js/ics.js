// Turns a restock date into something a real calendar app can add — an
// .ics file (works with iOS/macOS Calendar, Outlook, etc. via the share
// sheet) and a Google Calendar link (Google's own documented "render"
// endpoint for pre-filling an event — a plain URL, not an API call).

function icsDate(dateStr) {
  return dateStr.replace(/-/g, "");
}

function escapeIcsText(str) {
  return String(str).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
}

// All-day event, so DTSTART is a bare YYYYMMDD (VALUE=DATE) rather than a
// timestamp — restocking isn't tied to a specific hour.
export function buildIcsEvent({ title, date, description }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//My Closet//Stock items//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID ? crypto.randomUUID() : stamp + "-" + Math.random().toString(16).slice(2)}@my-closet`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(date)}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarLink({ title, date, description }) {
  // Google wants an exclusive end date for all-day events, so end = start + 1 day.
  const start = date.replace(/-/g, "");
  const endDate = new Date(date + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
  });
  if (description) params.set("details", description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

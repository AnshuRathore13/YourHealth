import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// In a real app, you'd load the refresh token from the database for the authenticated doctor/admin.
// For this project, we'll mock the calendar creation if tokens aren't provided.
let isCalendarAuthenticated = false;

export const setCalendarCredentials = (tokens: any) => {
  oauth2Client.setCredentials(tokens);
  isCalendarAuthenticated = true;
};

export const createCalendarEvent = async (eventDetails: any) => {
  if (!isCalendarAuthenticated) {
    console.log("[Calendar Mock] Created event:", eventDetails.summary);
    return "mock-event-id-" + Date.now();
  }
  
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  
  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.startDateTime,
      },
      end: {
        dateTime: eventDetails.endDateTime,
      },
    },
  });
  
  return response.data.id;
};

export const cancelCalendarEvent = async (eventId: string) => {
  if (!isCalendarAuthenticated || eventId.startsWith("mock-event-id")) {
    console.log("[Calendar Mock] Cancelled event:", eventId);
    return true;
  }
  
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
  
  return true;
};

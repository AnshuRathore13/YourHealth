"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelCalendarEvent = exports.createCalendarEvent = exports.setCalendarCredentials = void 0;
const googleapis_1 = require("googleapis");
const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
// In a real app, you'd load the refresh token from the database for the authenticated doctor/admin.
// For this project, we'll mock the calendar creation if tokens aren't provided.
let isCalendarAuthenticated = false;
const setCalendarCredentials = (tokens) => {
    oauth2Client.setCredentials(tokens);
    isCalendarAuthenticated = true;
};
exports.setCalendarCredentials = setCalendarCredentials;
const createCalendarEvent = async (eventDetails) => {
    if (!isCalendarAuthenticated) {
        console.log("[Calendar Mock] Created event:", eventDetails.summary);
        return "mock-event-id-" + Date.now();
    }
    const calendar = googleapis_1.google.calendar({ version: "v3", auth: oauth2Client });
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
exports.createCalendarEvent = createCalendarEvent;
const cancelCalendarEvent = async (eventId) => {
    if (!isCalendarAuthenticated || eventId.startsWith("mock-event-id")) {
        console.log("[Calendar Mock] Cancelled event:", eventId);
        return true;
    }
    const calendar = googleapis_1.google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.events.delete({
        calendarId: "primary",
        eventId,
    });
    return true;
};
exports.cancelCalendarEvent = cancelCalendarEvent;
//# sourceMappingURL=calendar.service.js.map
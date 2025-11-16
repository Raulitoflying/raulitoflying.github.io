/**
 * Google Meet Booking System
 * Uses Google Calendar API to create meetings with Google Meet links
 */

class GoogleMeetBooking {
  constructor(config) {
    this.clientId = config.clientId;
    this.apiKey = config.apiKey;
    this.discoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
    this.scopes = 'https://www.googleapis.com/auth/calendar.events';
    this.gapi = null;
    this.isSignedIn = false;
  }

  async initialize() {
    try {
      await this.loadGapi();
      await gapi.load('auth2', this.initializeGapiAuth.bind(this));
    } catch (error) {
      console.error('Error initializing Google API:', error);
    }
  }

  loadGapi() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }
    });
  }

  async initializeGapiAuth() {
    await gapi.client.init({
      apiKey: this.apiKey,
      clientId: this.clientId,
      discoveryDocs: [this.discoveryDoc],
      scope: this.scopes
    });

    this.authInstance = gapi.auth2.getAuthInstance();
    this.isSignedIn = this.authInstance.isSignedIn.get();
    
    // Update UI based on sign-in status
    this.updateSignInStatus();
  }

  async signIn() {
    try {
      await this.authInstance.signIn();
      this.isSignedIn = true;
      this.updateSignInStatus();
    } catch (error) {
      console.error('Error signing in:', error);
    }
  }

  async signOut() {
    await this.authInstance.signOut();
    this.isSignedIn = false;
    this.updateSignInStatus();
  }

  updateSignInStatus() {
    const signInBtn = document.getElementById('google-sign-in');
    const bookingForm = document.getElementById('meet-booking-form');
    
    if (this.isSignedIn) {
      signInBtn.style.display = 'none';
      bookingForm.style.display = 'block';
    } else {
      signInBtn.style.display = 'block';
      bookingForm.style.display = 'none';
    }
  }

  async createMeeting(meetingData) {
    if (!this.isSignedIn) {
      throw new Error('User must be signed in to create meetings');
    }

    const event = {
      summary: meetingData.title || 'Meeting with Raul',
      description: meetingData.description || 'Scheduled meeting',
      start: {
        dateTime: meetingData.startTime,
        timeZone: meetingData.timeZone || 'America/Los_Angeles'
      },
      end: {
        dateTime: meetingData.endTime,
        timeZone: meetingData.timeZone || 'America/Los_Angeles'
      },
      attendees: meetingData.attendees || [],
      conferenceData: {
        createRequest: {
          requestId: 'meet-' + Date.now(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        resource: event
      });

      return {
        success: true,
        meetingLink: response.result.hangoutLink,
        eventId: response.result.id,
        event: response.result
      };
    } catch (error) {
      console.error('Error creating meeting:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Helper method to format date/time
  formatDateTime(date, time) {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toISOString();
  }

  // Generate time slots for booking
  generateTimeSlots(date, startHour = 9, endHour = 17, interval = 30) {
    const slots = [];
    const baseDate = new Date(date);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const dateTime = new Date(baseDate);
        dateTime.setHours(hour, minute, 0, 0);
        
        // Skip past times for today
        if (dateTime > new Date()) {
          slots.push({
            time: time,
            dateTime: dateTime.toISOString(),
            display: dateTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })
          });
        }
      }
    }
    
    return slots;
  }
}

// Form handling
document.addEventListener('DOMContentLoaded', function() {
  // Initialize Google Meet booking (you'll need to set your own API keys)
  const meetBooking = new GoogleMeetBooking({
    clientId: 'YOUR_GOOGLE_CLIENT_ID',
    apiKey: 'YOUR_GOOGLE_API_KEY'
  });

  // Initialize when page loads
  meetBooking.initialize();

  // Handle sign in
  document.getElementById('google-sign-in')?.addEventListener('click', () => {
    meetBooking.signIn();
  });

  // Handle form submission
  document.getElementById('meet-booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const meetingData = {
      title: formData.get('meeting-title'),
      description: formData.get('meeting-description'),
      startTime: meetBooking.formatDateTime(formData.get('meeting-date'), formData.get('meeting-time')),
      endTime: meetBooking.formatDateTime(formData.get('meeting-date'), 
        addMinutes(formData.get('meeting-time'), parseInt(formData.get('duration')))),
      attendees: [
        { email: formData.get('attendee-email') }
      ]
    };

    const result = await meetBooking.createMeeting(meetingData);
    
    if (result.success) {
      showSuccess(`Meeting created! Google Meet link: ${result.meetingLink}`);
    } else {
      showError(`Error creating meeting: ${result.error}`);
    }
  });

  // Helper functions
  function addMinutes(time, minutes) {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }

  function showSuccess(message) {
    // Implement your success notification
    alert(message); // Replace with better UI
  }

  function showError(message) {
    // Implement your error notification
    alert(message); // Replace with better UI
  }

  // Generate time slots for today
  const today = new Date().toISOString().split('T')[0];
  const timeSelect = document.getElementById('meeting-time');
  if (timeSelect) {
    const slots = meetBooking.generateTimeSlots(today);
    slots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot.time;
      option.textContent = slot.display;
      timeSelect.appendChild(option);
    });
  }
});

// Export for use in other scripts
window.GoogleMeetBooking = GoogleMeetBooking; 
requireAuthenticatedUser();

const tripRef = initializeFirebaseDatabase().ref("shanghai");

function showTripError(message) {
  document.getElementById("france-error").textContent = message;
}

function renderCountdown() {
  if (!document.hidden) document.getElementById("france-count").textContent = window.shanghaiTrip.countdown();
}

const days = Array.from({ length: window.shanghaiTrip.dayCount }, (unused, index) => ({
  key: "day-" + (index + 1),
  label: window.shanghaiTrip.dateForDay(index).toLocaleDateString("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric",
  }).toLowerCase(),
}));
document.getElementById("trip-dates").textContent = window.shanghaiTrip.label;
initializeTripItinerary(tripRef, days, showTripError);
initializeTripReservations(tripRef, showTripError);

function addChongqingBookingsOnce() {
  return tripRef.child("_chongqingBookings20261005").once("value").then((snapshot) => {
    if (snapshot.val()) return;
    return tripRef.transaction((current) => {
      const trip = current || {};
      if (trip._chongqingBookings20261005) return;
      const additions = {
        "day-14": "✈️ Shanghai (SHA) → Chongqing (CKG)\nThu 3 Dec 2026 · 16:05–19:05 (China time)\nBooked via Booking.com.\n🏨 ARISTON AIRESTON HOTEL — 3–7 Dec, 4 nights.\nCheck-in available after 15:00 on 3 Dec; arrive after the flight and transfer.\nHotel booked via BOOKING.COM.",
        "day-15": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
        "day-16": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
        "day-17": "📍 Chongqing\n🏨 Staying at ARISTON AIRESTON HOTEL — booked via BOOKING.COM.",
        "day-18": "🏨 Check out of ARISTON AIRESTON HOTEL by 12:00 on Mon 7 Dec 2026.\nHotel booked via BOOKING.COM.\n✈️ Chongqing (CKG) → Shanghai (SHA)\nMon 7 Dec 2026 · 20:10–22:25 (China time)\nBooked via Booking.com."
      };
      for (const [key, notes] of Object.entries(additions)) {
        const existing = typeof trip[key] === "string" ? trip[key].trimEnd() : "";
        trip[key] = existing ? existing + "\n\n" + notes : notes;
      }
      trip._resv = trip._resv || {};
      trip._resv.hotel = trip._resv.hotel || {};
      if (!trip._resv.hotel["chongqing-ariston-20261203"]) {
        trip._resv.hotel["chongqing-ariston-20261203"] = {
          title: "ARISTON AIRESTON HOTEL · booked via BOOKING.COM",
          when: "Chongqing · 3 Dec 2026 after 15:00 → 7 Dec 2026 at 12:00 · 4 nights · China time",
          address: "", code: "", at: 1791158400000
        };
      }
      trip._chongqingBookings20261005 = true;
      return trip;
    });
  }).catch((error) => {
    console.error("Chongqing booking update failed:", error);
    showTripError("couldn't add the Chongqing bookings — refresh to try again");
  });
}

renderCountdown();
addChongqingBookingsOnce();
setInterval(renderCountdown, 60000);

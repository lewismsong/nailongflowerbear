requireAuthenticatedUser();

const tripRef = initializeFirebaseDatabase().ref("toronto");
const TRIP_DAY_COUNT = 10; // placeholder days until we pick real dates

function showTripError(message) {
  document.getElementById("france-error").textContent = message;
}

const days = Array.from({ length: TRIP_DAY_COUNT }, (unused, index) => ({ key: "day-" + (index + 1) }));
initializeTripItinerary(tripRef, days, showTripError);
initializeTripDates(tripRef, showTripError);
initializeTripReservations(tripRef, showTripError);
document.getElementById("france-count").textContent = "🍁";

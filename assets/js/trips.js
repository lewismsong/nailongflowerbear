// the trip list mirrors whatever dates were typed on each city's own page
const tripsDatabase = initializeFirebaseDatabase();

document.querySelectorAll(".trip-when[data-trip]").forEach((element) => {
  const trip = element.dataset.trip;
  const fallback = element.textContent;
  tripsDatabase.ref(trip).child("_dates").on(
    "value",
    (snapshot) => {
      const dates = snapshot.val();
      element.textContent = typeof dates === "string" && dates.trim() ? dates.trim() : fallback;
    },
    (error) => {
      console.error("trip dates subscription failed for " + trip + ":", error);
    }
  );
});

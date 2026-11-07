// france itinerary: august 13–27, 2026, inclusive; keys use the game's toronto dates.
const GameScore = {
  isFranceDay(key) { return key >= '2026-08-13' && key <= '2026-08-27'; },
  tally(days, todayKey, includeFrance) {
    const wins = { khali: 0, lewis: 0 };
    for (const [key, record] of Object.entries(days)) {
      if (key >= todayKey || (!includeFrance && this.isFranceDay(key))) continue;
      if (record.k > record.l) wins.khali++;
      else if (record.l > record.k) wins.lewis++;
    }
    return wins;
  }
};

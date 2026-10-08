class MissHistory {
  constructor(dayKey) {
    this.dayKey = dayKey;
    this.records = new Map();
    this.totals = new Map();
    this.days = new Map();
    this.lastBySender = new Map();
    this.latest = null;
    this.version = 0;
  }

  update(id, value) {
    if (!value || typeof value.from !== "string" || !Number.isFinite(value.at)
        || value.at <= 0 || !Number.isFinite(new Date(value.at).getTime())) {
      this.remove(id);
      return;
    }
    const event = { id, from: value.from.trim().toLowerCase(), at: value.at };
    const previous = this.records.get(id);
    if (previous?.from === event.from && previous.at === event.at) return;
    if (previous) this.adjustCounts(previous, -1);
    this.records.set(id, event);
    this.adjustCounts(event, 1);
    if (this.latest === previous) this.latest = this.isLater(event, previous) ? event : this.findLatest();
    else if (this.isLater(event, this.latest)) this.latest = event;
    if (previous && this.lastBySender.get(previous.from) === previous) {
      this.lastBySender.set(previous.from,
        event.from === previous.from && this.isLater(event, previous) ? event : this.findLatest(previous.from));
    }
    if (this.isLater(event, this.lastBySender.get(event.from))) this.lastBySender.set(event.from, event);
    this.version++;
  }

  remove(id) {
    const event = this.records.get(id);
    if (!event) return;
    this.records.delete(id);
    this.adjustCounts(event, -1);
    // only deletions of the latest records require a scan.
    if (this.latest === event) this.latest = this.findLatest();
    if (this.lastBySender.get(event.from) === event) {
      this.lastBySender.set(event.from, this.findLatest(event.from));
    }
    this.version++;
  }

  isLater(event, previous) {
    return !previous || event.at > previous.at || (event.at === previous.at && event.id > previous.id);
  }

  findLatest(sender) {
    let latest = null;
    for (const event of this.records.values()) {
      if ((sender === undefined || event.from === sender) && this.isLater(event, latest)) latest = event;
    }
    return latest;
  }

  adjustCounts(event, change) {
    this.totals.set(event.from, this.count(event.from) + change);
    const key = this.dayKey(event.at);
    const day = this.days.get(key) || new Map();
    day.set(event.from, (day.get(event.from) || 0) + change);
    if ([...day.values()].every(count => count === 0)) this.days.delete(key);
    else this.days.set(key, day);
  }

  count(sender) {
    return this.totals.get(sender) || 0;
  }

  countOnDay(sender, key) {
    return this.days.get(key)?.get(sender) || 0;
  }

  lastAt(sender) {
    return this.lastBySender.get(sender)?.at || 0;
  }
}

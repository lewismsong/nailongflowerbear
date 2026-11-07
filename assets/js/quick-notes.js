(() => {
  const NOTES_LIST_NAME = "notes";
  const RECENT_NOTE_LIMIT = 2;
  const ACTIVE_LIST_STORAGE_KEY = "ily:activeTodoList";
  const noteBears = { khali: "🐻‍❄️", lewis: "🐻" };
  const form = document.getElementById("quick-notes-form");
  const input = document.getElementById("quick-notes-input");
  const submitButton = form?.querySelector("button");
  const emptyMessage = document.getElementById("quick-notes-empty");
  const noteList = document.getElementById("quick-notes-list");
  const errorMessage = document.getElementById("quick-notes-error");
  const openAllLink = document.getElementById("quick-notes-open");

  if (!form || !input || !submitButton || !emptyMessage || !noteList || !errorMessage || !openAllLink) return;

  const currentUser = currentAuthenticatedUser();
  const relativeTimeFormatter = new Intl.RelativeTimeFormat([], { numeric: "auto" });
  let notesListId = null;
  let todoItemsReference = null;
  let submitting = false;

  function setError(message) {
    errorMessage.textContent = message;
  }

  function setControlsEnabled(enabled) {
    input.disabled = !enabled || submitting;
    submitButton.disabled = input.disabled;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "just now";
    const elapsedMinutes = Math.round((timestamp - Date.now()) / 60000);
    if (Math.abs(elapsedMinutes) < 60) return relativeTimeFormatter.format(elapsedMinutes, "minute");
    const elapsedHours = Math.round(elapsedMinutes / 60);
    if (Math.abs(elapsedHours) < 24) return relativeTimeFormatter.format(elapsedHours, "hour");
    return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function createNoteElement(note) {
    const item = document.createElement("li");
    item.className = "quick-note " + (note.from === "lewis" ? "lewis" : "khali");

    const bear = document.createElement("span");
    bear.className = "quick-note-bear";
    bear.textContent = noteBears[note.from] || "🐻";
    bear.setAttribute("aria-hidden", "true");

    const copy = document.createElement("div");
    copy.className = "quick-note-copy";
    const text = document.createElement("p");
    text.className = "quick-note-text";
    text.textContent = note.text;
    const time = document.createElement("time");
    time.className = "quick-note-time";
    time.dateTime = note.at ? new Date(note.at).toISOString() : "";
    time.textContent = formatRelativeTime(note.at);
    copy.append(text, time);

    const deleteButton = document.createElement("button");
    deleteButton.className = "quick-note-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "delete note");
    deleteButton.addEventListener("click", async () => {
      if (!todoItemsReference) return;
      deleteButton.disabled = true;
      try {
        await todoItemsReference.child(note.id).remove();
        setError("");
      } catch (error) {
        console.error("quick note deletion failed:", error);
        deleteButton.disabled = false;
        setError("couldn't delete that note — check your connection");
      }
    });

    item.append(bear, copy, deleteButton);
    return item;
  }

  function parseNotes(value) {
    const lists = value.lists && typeof value.lists === "object" ? value.lists : {};
    notesListId = Object.entries(lists).find(([id, list]) => {
      const normalizedName = String(list?.name || "").trim().toLocaleLowerCase();
      return id === NOTES_LIST_NAME || normalizedName === NOTES_LIST_NAME;
    })?.[0] || null;

    if (!notesListId) return [];
    const items = value.items && typeof value.items === "object" ? value.items : {};
    return Object.entries(items)
      .map(([id, note]) => ({ id, ...note }))
      .filter((note) => note.listId === notesListId && typeof note.text === "string" && note.text.trim())
      .map((note) => ({ ...note, text: note.text.trim(), at: Number(note.at) || 0 }))
      .sort((firstNote, secondNote) => secondNote.at - firstNote.at)
      .slice(0, RECENT_NOTE_LIMIT);
  }

  function renderNotes(value) {
    const notes = parseNotes(value);
    noteList.replaceChildren(...notes.map(createNoteElement));
    emptyMessage.classList.toggle("hidden", notes.length > 0);
    emptyMessage.textContent = notesListId ? "nothing here yet" : "add a notes tab in list first";
    setControlsEnabled(Boolean(currentUser && notesListId && todoItemsReference));
  }

  openAllLink.addEventListener("click", () => {
    if (notesListId) appStorage.set(ACTIVE_LIST_STORAGE_KEY, notesListId);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !currentUser || !notesListId || !todoItemsReference || submitting) return;

    submitting = true;
    setControlsEnabled(true);
    try {
      await todoItemsReference.push({
        listId: notesListId,
        text,
        from: currentUser,
        done: false,
        at: firebase.database.ServerValue.TIMESTAMP,
      });
      input.value = "";
      input.focus();
      setError("");
    } catch (error) {
      console.error("quick note creation failed:", error);
      setError("couldn't save that note — check your connection");
    } finally {
      submitting = false;
      setControlsEnabled(true);
    }
  });

  if (!currentUser) {
    emptyMessage.textContent = "sign in to see notes";
    return;
  }

  try {
    const todoRootReference = initializeFirebaseDatabase().ref("todos");
    todoItemsReference = todoRootReference.child("items");
    todoRootReference.on("value", (snapshot) => {
      renderNotes(snapshot.val() || {});
      setError("");
    }, (error) => {
      console.error("quick notes subscription failed:", error);
      setControlsEnabled(false);
      setError("couldn't load notes — check your connection");
    });
  } catch (error) {
    console.error("quick notes initialization failed:", error);
    emptyMessage.textContent = "notes unavailable";
    setError("couldn't connect to notes");
  }
})();

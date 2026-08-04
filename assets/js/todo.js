const TODO_ROOT_PATH = "todos";
const TODO_SCHEMA_VERSION = 2;
const ACTIVE_LIST_STORAGE_KEY = "ily:activeTodoList";
const DEFAULT_TODO_LISTS = [
  { id: "grocery-list", name: "grocery list", order: 0 },
  { id: "todos", name: "todos", order: 1 },
  { id: "to-watch", name: "to watch", order: 2 },
];
const RESERVED_TODO_KEYS = new Set(["items", "lists", "meta"]);

const todoName = appStorage.get("ily:name", "").trim().toLowerCase();
const todoBears = { khali: "🐻‍❄️", lewis: "🐻" };
const todoList = document.getElementById("todo-list");
const todoEmpty = document.getElementById("todo-empty");
const todoCount = document.getElementById("todo-count");
const todoProgressText = document.getElementById("todo-progress-text");
const todoProgressBar = document.getElementById("todo-progress-bar");
const todoTabs = document.getElementById("todo-tabs");
const todoPanel = document.getElementById("todo-panel");
const todoListAdd = document.getElementById("todo-list-add");
const todoListRename = document.getElementById("todo-list-rename");
const todoListDelete = document.getElementById("todo-list-delete");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoSubmit = todoForm.querySelector("button");
const todoError = document.getElementById("todo-error");
const todoPerson = document.getElementById("todo-person");
const myBear = document.getElementById("my-bear");
const validTodoUser = Boolean(todoBears[todoName]);
const pendingSaves = new Map();
const todoDateFormatter = new Intl.DateTimeFormat([], { day: "numeric", month: "short", year: "numeric" });
const todoTimeFormatter = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

let todoLists = [];
let todos = [];
let activeListId = appStorage.get(ACTIVE_LIST_STORAGE_KEY);
let todoRootRef = null;
let todoListsRef = null;
let todoItemsRef = null;
let renderQueued = false;
let todoSubmitting = false;
let structureInitializationStarted = false;
let editingListId = null;
let draggedListId = null;
let pointerDragState = null;

function showTodoError(message) {
  todoError.textContent = message;
}

function isEditingText() {
  const activeElement = document.activeElement;
  return activeElement?.classList.contains("todo-text") === true
    || activeElement?.classList.contains("todo-tab-input") === true;
}

function flushQueuedRender() {
  if (!renderQueued) return;
  renderQueued = false;
  renderTodos();
}

function cancelPendingSave(id) {
  const timer = pendingSaves.get(id);
  if (timer) clearTimeout(timer);
  pendingSaves.delete(id);
}

function normalizeListName(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function activeTodoList() {
  return todoLists.find((list) => list.id === activeListId) || null;
}

function persistActiveListId() {
  if (activeListId) appStorage.set(ACTIVE_LIST_STORAGE_KEY, activeListId);
  else appStorage.remove(ACTIVE_LIST_STORAGE_KEY);
}

function setActiveList(id) {
  if (activeListId === id && editingListId === null) return;
  editingListId = null;
  activeListId = id || null;
  persistActiveListId();
  renderTodos();
}

function ensureActiveList() {
  if (activeTodoList()) return;
  const defaultList = todoLists.find((list) => list.id === "todos");
  activeListId = defaultList?.id || todoLists[0]?.id || null;
  persistActiveListId();
}

function syncTodoControls() {
  const hasActiveList = Boolean(activeTodoList());
  const canEditLists = validTodoUser && Boolean(todoListsRef);

  todoListAdd.disabled = !canEditLists;
  todoListRename.disabled = !canEditLists || !hasActiveList || editingListId === activeListId;
  todoListDelete.disabled = !canEditLists || !hasActiveList;
  todoInput.disabled = !validTodoUser || !todoItemsRef || !hasActiveList || todoSubmitting;
  todoSubmit.disabled = todoInput.disabled;
  todoInput.placeholder = hasActiveList ? "write something" : "add a list first";
}

async function updateTodo(id, changes) {
  if (!todoItemsRef) return false;
  try {
    await todoItemsRef.child(id).update(changes);
    showTodoError("");
    return true;
  } catch (error) {
    console.error("todo update failed:", error);
    showTodoError("couldn't save that — check your connection and try again");
    return false;
  }
}

function scheduleTextSave(id, textElement) {
  const previousTimer = pendingSaves.get(id);
  if (previousTimer) clearTimeout(previousTimer);
  const timer = setTimeout(async () => {
    pendingSaves.delete(id);
    const text = textElement.textContent.trim();
    if (!text) return;
    if (await updateTodo(id, { text })) textElement.dataset.savedText = text;
  }, 300);
  pendingSaves.set(id, timer);
}

function createTodoTimestamp(timestamp) {
  const stamp = document.createElement("time");
  stamp.className = "todo-stamp";
  if (timestamp <= 0) {
    stamp.textContent = "date unknown";
    return stamp;
  }

  const date = new Date(timestamp);
  stamp.dateTime = date.toISOString();

  const dateText = document.createElement("span");
  dateText.textContent = todoDateFormatter.format(date);
  const timeText = document.createElement("span");
  timeText.textContent = todoTimeFormatter.format(date);
  stamp.append(dateText, timeText);
  return stamp;
}

function createTodoItem(todo) {
  const item = document.createElement("li");
  item.className = "todo-item";
  item.dataset.id = todo.id;

  const checkbox = document.createElement("input");
  checkbox.className = "todo-check";
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.setAttribute("aria-label", "mark todo complete");
  checkbox.addEventListener("change", async () => {
    if (!await updateTodo(todo.id, { done: checkbox.checked })) checkbox.checked = !checkbox.checked;
  });

  const bear = document.createElement("span");
  bear.className = "todo-bear";
  bear.textContent = todoBears[todo.from];
  bear.setAttribute("aria-hidden", "true");

  const text = document.createElement("div");
  text.className = "todo-text";
  text.contentEditable = "true";
  text.textContent = todo.text;
  text.dataset.savedText = todo.text;
  text.setAttribute("role", "textbox");
  text.setAttribute("aria-label", "edit todo");
  text.setAttribute("spellcheck", "true");
  text.addEventListener("input", () => scheduleTextSave(todo.id, text));
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      text.blur();
    }
  });
  text.addEventListener("blur", async () => {
    cancelPendingSave(todo.id);
    const newText = text.textContent.trim();
    if (!newText) {
      text.textContent = text.dataset.savedText;
      showTodoError("a list item can't be empty — use × to remove it");
      flushQueuedRender();
      return;
    }
    if (newText !== text.dataset.savedText) {
      if (await updateTodo(todo.id, { text: newText })) text.dataset.savedText = newText;
      else text.textContent = text.dataset.savedText;
    }
    flushQueuedRender();
  });

  const stamp = createTodoTimestamp(todo.at);

  const removeButton = document.createElement("button");
  removeButton.className = "todo-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "delete todo");
  removeButton.addEventListener("click", async () => {
    cancelPendingSave(todo.id);
    try {
      await todoItemsRef.child(todo.id).remove();
      showTodoError("");
    } catch (error) {
      console.error("todo deletion failed:", error);
      showTodoError("couldn't delete that — check your connection and try again");
    }
  });

  item.classList.toggle("done", todo.done);
  item.append(checkbox, bear, text, stamp, removeButton);
  return item;
}

function createTodoTab(list) {
  const tab = document.createElement("div");
  const selected = list.id === activeListId;
  tab.className = "todo-tab";
  tab.id = "todo-tab-" + list.id;
  tab.dataset.listId = list.id;
  tab.draggable = editingListId !== list.id;
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(selected));
  tab.setAttribute("tabindex", selected ? "0" : "-1");

  const grip = document.createElement("span");
  grip.className = "todo-tab-grip";
  grip.textContent = "⠿";
  grip.setAttribute("aria-hidden", "true");
  grip.addEventListener("pointerdown", (event) => beginPointerTabDrag(event, list.id, tab));
  grip.addEventListener("pointermove", movePointerTabDrag);
  grip.addEventListener("pointerup", endPointerTabDrag);
  grip.addEventListener("pointercancel", endPointerTabDrag);

  if (editingListId === list.id) {
    const input = document.createElement("input");
    input.className = "todo-tab-input";
    input.value = list.name;
    input.size = Math.min(24, Math.max(4, list.name.length));
    input.maxLength = 60;
    input.setAttribute("aria-label", "rename " + list.name);
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        editingListId = null;
        renderTodos();
      }
    });
    input.addEventListener("blur", () => saveInlineListName(list, input.value));
    tab.append(grip, input);
  } else {
    const name = document.createElement("span");
    name.className = "todo-tab-name";
    name.textContent = list.name;
    tab.append(grip, name);
  }

  tab.addEventListener("click", () => {
    if (editingListId !== list.id) setActiveList(list.id);
  });
  tab.addEventListener("dblclick", () => startInlineListRename(list));
  tab.addEventListener("keydown", (event) => {
    if (event.target.classList.contains("todo-tab-input")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveList(list.id);
      return;
    }
    const currentIndex = todoLists.findIndex((candidate) => candidate.id === list.id);
    const lastIndex = todoLists.length - 1;
    let nextIndex = null;
    if (event.key === "ArrowLeft") nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    if (event.key === "ArrowRight") nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextList = todoLists[nextIndex];
    setActiveList(nextList.id);
    requestAnimationFrame(() => document.getElementById("todo-tab-" + nextList.id)?.focus());
  });
  tab.addEventListener("dragstart", (event) => {
    if (editingListId === list.id) {
      event.preventDefault();
      return;
    }
    draggedListId = list.id;
    tab.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", list.id);
  });
  tab.addEventListener("dragover", (event) => {
    if (!draggedListId || draggedListId === list.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    showTabDropPosition(tab, event.clientX > tab.getBoundingClientRect().left + tab.offsetWidth / 2);
  });
  tab.addEventListener("drop", (event) => {
    if (!draggedListId || draggedListId === list.id) return;
    event.preventDefault();
    const placeAfter = event.clientX > tab.getBoundingClientRect().left + tab.offsetWidth / 2;
    persistTodoListOrder(draggedListId, list.id, placeAfter);
    finishTabDrag();
  });
  tab.addEventListener("dragend", finishTabDrag);
  return tab;
}

function renderTodoTabs() {
  todoTabs.replaceChildren(...todoLists.map(createTodoTab));
}

function clearTabDropPositions() {
  todoTabs.querySelectorAll(".drop-before, .drop-after").forEach((tab) => {
    tab.classList.remove("drop-before", "drop-after");
  });
}

function showTabDropPosition(tab, placeAfter) {
  clearTabDropPositions();
  tab.classList.add(placeAfter ? "drop-after" : "drop-before");
}

function finishTabDrag() {
  draggedListId = null;
  clearTabDropPositions();
  todoTabs.querySelectorAll(".dragging").forEach((tab) => tab.classList.remove("dragging"));
}

function reorderedTodoLists(draggedId, targetId, placeAfter) {
  const draggedList = todoLists.find((list) => list.id === draggedId);
  if (!draggedList || draggedId === targetId) return todoLists;

  const reorderedLists = todoLists.filter((list) => list.id !== draggedId);
  const targetIndex = reorderedLists.findIndex((list) => list.id === targetId);
  if (targetIndex < 0) return todoLists;
  reorderedLists.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedList);
  return reorderedLists;
}

async function persistTodoListOrder(draggedId, targetId, placeAfter) {
  if (!todoListsRef) return;
  const previousLists = todoLists;
  const reorderedLists = reorderedTodoLists(draggedId, targetId, placeAfter);
  if (reorderedLists.every((list, index) => list.id === previousLists[index].id)) return;

  todoLists = reorderedLists.map((list, index) => ({ ...list, order: index }));
  renderTodos();
  const updates = {};
  for (const list of todoLists) updates[list.id + "/order"] = list.order;

  try {
    await todoListsRef.update(updates);
    showTodoError("");
  } catch (error) {
    console.error("todo list reorder failed:", error);
    todoLists = previousLists;
    renderTodos();
    showTodoError("couldn't reorder those lists — check your connection and try again");
  }
}

function beginPointerTabDrag(event, listId, tab) {
  if (!validTodoUser || !todoListsRef || editingListId === listId) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  draggedListId = listId;
  pointerDragState = {
    pointerId: event.pointerId,
    sourceId: listId,
    targetId: null,
    placeAfter: false,
  };
  tab.classList.add("dragging");
}

function movePointerTabDrag(event) {
  if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
  event.preventDefault();
  const tabsBounds = todoTabs.getBoundingClientRect();
  if (event.clientX < tabsBounds.left + 32) todoTabs.scrollBy({ left: -12 });
  if (event.clientX > tabsBounds.right - 32) todoTabs.scrollBy({ left: 12 });

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".todo-tab");
  if (!target || !todoTabs.contains(target) || target.dataset.listId === pointerDragState.sourceId) {
    pointerDragState.targetId = null;
    clearTabDropPositions();
    return;
  }

  pointerDragState.targetId = target.dataset.listId;
  pointerDragState.placeAfter = event.clientX > target.getBoundingClientRect().left + target.offsetWidth / 2;
  showTabDropPosition(target, pointerDragState.placeAfter);
}

function endPointerTabDrag(event) {
  if (!pointerDragState || event.pointerId !== pointerDragState.pointerId) return;
  event.preventDefault();
  const { sourceId, targetId, placeAfter } = pointerDragState;
  pointerDragState = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  if (targetId) persistTodoListOrder(sourceId, targetId, placeAfter);
  finishTabDrag();
}

function renderTodos() {
  ensureActiveList();
  const selectedList = activeTodoList();
  const visibleTodos = selectedList ? todos.filter((todo) => todo.listId === selectedList.id) : [];
  const openCount = visibleTodos.filter((todo) => !todo.done).length;
  const completedCount = visibleTodos.length - openCount;
  const completionPercentage = visibleTodos.length
    ? Math.round((completedCount / visibleTodos.length) * 100)
    : 0;

  renderTodoTabs();
  if (selectedList) todoPanel.setAttribute("aria-labelledby", "todo-tab-" + selectedList.id);
  else todoPanel.removeAttribute("aria-labelledby");
  todoList.replaceChildren(...visibleTodos.map(createTodoItem));
  todoCount.textContent = selectedList ? openCount + " open in " + selectedList.name : "choose or add a list";
  todoProgressText.textContent = completedCount + " of " + visibleTodos.length + " done";
  todoProgressBar.style.width = completionPercentage + "%";
  todoEmpty.textContent = selectedList ? "nothing here yet" : "add a list to get started";
  todoEmpty.classList.toggle("hidden", visibleTodos.length > 0);
  syncTodoControls();
}

function isTodoRecord(value) {
  return value && typeof value === "object" && typeof value.text === "string" && value.text.trim();
}

function legacyTodoEntries(value) {
  return Object.entries(value)
    .filter(([id, todo]) => !RESERVED_TODO_KEYS.has(id) && isTodoRecord(todo));
}

function parseTodoLists(value) {
  const listsValue = value.lists && typeof value.lists === "object" ? value.lists : {};
  return Object.entries(listsValue)
    .map(([id, list]) => {
      const name = normalizeListName(list && list.name);
      if (!name) return null;
      return { id, name, order: Number(list.order) || 0 };
    })
    .filter(Boolean)
    .sort((first, second) => first.order - second.order || first.name.localeCompare(second.name));
}

function parseTodos(value) {
  const itemsValue = value.items && typeof value.items === "object" ? value.items : {};
  const combinedItems = new Map(Object.entries(itemsValue));
  for (const [id, todo] of legacyTodoEntries(value)) {
    if (!combinedItems.has(id)) combinedItems.set(id, todo);
  }

  return [...combinedItems]
    .map(([id, todo]) => isTodoRecord(todo) ? { id, ...todo } : null)
    .filter(Boolean)
    .map((todo) => ({
      id: todo.id,
      listId: typeof todo.listId === "string" && todo.listId ? todo.listId : "todos",
      text: todo.text.trim(),
      from: todoBears[todo.from] ? todo.from : "lewis",
      done: todo.done === true,
      at: Number(todo.at) || 0,
    }))
    .sort((first, second) => {
      if (first.done !== second.done) return Number(first.done) - Number(second.done);
      return second.at - first.at;
    });
}

async function initializeTodoStructure(value) {
  if (structureInitializationStarted || !todoRootRef) return;
  const schemaVersion = Number(value.meta && value.meta.schemaVersion) || 0;
  const legacyEntries = legacyTodoEntries(value);
  if (schemaVersion >= TODO_SCHEMA_VERSION && legacyEntries.length === 0) return;

  structureInitializationStarted = true;
  const updates = { "meta/schemaVersion": TODO_SCHEMA_VERSION };
  const existingLists = parseTodoLists(value);
  if (existingLists.length === 0) {
    for (const list of DEFAULT_TODO_LISTS) {
      updates["lists/" + list.id] = { name: list.name, order: list.order };
    }
  }
  for (const [id, todo] of legacyEntries) {
    updates["items/" + id] = { ...todo, listId: "todos" };
    updates[id] = null;
  }

  try {
    await todoRootRef.update(updates);
  } catch (error) {
    console.error("todo structure initialization failed:", error);
    showTodoError("couldn't prepare the lists — check your connection and Firebase rules");
  }
}

function subscribeToTodos() {
  todoRootRef.on("value", (snapshot) => {
    const value = snapshot.val() || {};
    todoLists = parseTodoLists(value);
    todos = parseTodos(value);
    initializeTodoStructure(value);

    if (isEditingText()) renderQueued = true;
    else {
      renderQueued = false;
      renderTodos();
    }
    if (validTodoUser) showTodoError("");
  }, (error) => {
    console.error("todo subscription failed:", error);
    showTodoError("can't reach the todo database — check the Firebase rules");
  });
}

function requestedListName(message, initialValue = "") {
  const response = window.prompt(message, initialValue);
  if (response === null) return null;
  const name = normalizeListName(response);
  if (!name) {
    showTodoError("a list needs a name");
    return null;
  }
  return name;
}

function listNameExists(name, ignoredId = null) {
  const normalizedName = name.toLocaleLowerCase();
  return todoLists.some((list) => list.id !== ignoredId && list.name.toLocaleLowerCase() === normalizedName);
}

async function addTodoList() {
  if (!todoListsRef) return;
  const name = requestedListName("name your new list");
  if (!name) return;
  if (listNameExists(name)) {
    showTodoError("that list already exists");
    return;
  }

  const listRef = todoListsRef.push();
  activeListId = listRef.key;
  persistActiveListId();
  try {
    await listRef.set({ name, order: Date.now() });
    showTodoError("");
  } catch (error) {
    console.error("todo list creation failed:", error);
    showTodoError("couldn't add that list — check your connection and try again");
    ensureActiveList();
    renderTodos();
  }
}

function startInlineListRename(list = activeTodoList()) {
  if (!todoListsRef || !list) return;
  activeListId = list.id;
  persistActiveListId();
  editingListId = list.id;
  renderTodos();
  requestAnimationFrame(() => {
    const input = document.querySelector("#todo-tab-" + list.id + " .todo-tab-input");
    input?.focus();
    input?.select();
    input?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

async function saveInlineListName(list, value) {
  if (editingListId !== list.id) return;
  const name = normalizeListName(value);
  editingListId = null;
  renderTodos();

  if (!name) {
    showTodoError("a list needs a name");
    return;
  }
  if (name === list.name) return;
  if (listNameExists(name, list.id)) {
    showTodoError("that list already exists");
    return;
  }

  try {
    await todoListsRef.child(list.id).update({ name });
    showTodoError("");
  } catch (error) {
    console.error("todo list rename failed:", error);
    showTodoError("couldn't rename that list — check your connection and try again");
  }
}

async function deleteActiveTodoList() {
  const list = activeTodoList();
  if (!todoRootRef || !list) return;
  if (!window.confirm('delete "' + list.name + '" and everything in it?')) return;

  const updates = { ["lists/" + list.id]: null };
  for (const todo of todos) {
    if (todo.listId === list.id) updates["items/" + todo.id] = null;
  }
  const nextList = todoLists.find((candidate) => candidate.id !== list.id);
  activeListId = nextList?.id || null;
  persistActiveListId();

  try {
    await todoRootRef.update(updates);
    showTodoError("");
  } catch (error) {
    console.error("todo list deletion failed:", error);
    showTodoError("couldn't delete that list — check your connection and try again");
    activeListId = list.id;
    persistActiveListId();
    renderTodos();
  }
}

todoPerson.textContent = validTodoUser ? "writing as " + todoName : "not signed in";
myBear.textContent = todoBears[todoName] || "🐻";

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = todoInput.value.trim();
  const selectedList = activeTodoList();
  if (!text || !validTodoUser || !todoItemsRef || !selectedList) return;

  todoSubmitting = true;
  syncTodoControls();
  try {
    await todoItemsRef.push({
      listId: selectedList.id,
      text,
      from: todoName,
      done: false,
      at: firebase.database.ServerValue.TIMESTAMP,
    });
    todoInput.value = "";
    todoInput.focus();
    showTodoError("");
  } catch (error) {
    console.error("todo creation failed:", error);
    showTodoError("couldn't add that — check your connection and try again");
  } finally {
    todoSubmitting = false;
    syncTodoControls();
  }
});

todoListAdd.addEventListener("click", addTodoList);
todoListRename.addEventListener("click", () => startInlineListRename());
todoListDelete.addEventListener("click", deleteActiveTodoList);

renderTodos();

if (!validTodoUser) {
  showTodoError("go back home and sign in first");
}

if (firebaseConfig.databaseURL) {
  try {
    todoRootRef = initializeFirebaseDatabase().ref(TODO_ROOT_PATH);
    todoListsRef = todoRootRef.child("lists");
    todoItemsRef = todoRootRef.child("items");
    subscribeToTodos();
    syncTodoControls();
  } catch (error) {
    console.error("firebase initialization failed:", error);
    showTodoError("couldn't connect to the todo database");
    syncTodoControls();
  }
} else {
  showTodoError("Firebase isn't configured yet");
  syncTodoControls();
}

const todoName = (localStorage.getItem("ily:name") || "").trim().toLowerCase();
const todoBears = { khali: "🐻‍❄️", lewis: "🐻" };
const todoList = document.getElementById("todo-list");
const todoEmpty = document.getElementById("todo-empty");
const todoCount = document.getElementById("todo-count");
const todoProgressText = document.getElementById("todo-progress-text");
const todoProgressBar = document.getElementById("todo-progress-bar");
const todoFilterButtons = document.querySelectorAll(".todo-filters button");
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

let todos = [];
let todosRef = null;
let renderQueued = false;
let activeTodoFilter = "all";

function showTodoError(message) {
  todoError.textContent = message;
}

function isEditingText() {
  return document.activeElement?.classList.contains("todo-text") === true;
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

function disableTodoForm(message) {
  todoInput.disabled = true;
  todoSubmit.disabled = true;
  showTodoError(message);
}

async function updateTodo(id, changes) {
  try {
    await todosRef.child(id).update(changes);
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
      await todosRef.child(todo.id).remove();
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

function renderTodos() {
  const visibleTodos = todos.filter((todo) => {
    if (activeTodoFilter === "open") return !todo.done;
    if (activeTodoFilter === "done") return todo.done;
    return true;
  });
  const openCount = todos.filter((todo) => !todo.done).length;
  const completedCount = todos.length - openCount;
  const completionPercentage = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;

  todoList.replaceChildren(...visibleTodos.map(createTodoItem));
  todoCount.textContent = openCount + " open";
  todoProgressText.textContent = completedCount + " of " + todos.length + " done";
  todoProgressBar.style.width = completionPercentage + "%";
  todoEmpty.textContent = todos.length === 0
    ? "nothing here yet"
    : activeTodoFilter === "open"
      ? "all caught up ✨"
      : "nothing completed yet";
  todoEmpty.classList.toggle("hidden", visibleTodos.length > 0);
}

function subscribeToTodos() {
  todosRef.on("value", (snapshot) => {
    const value = snapshot.val() || {};
    todos = Object.entries(value)
      .map(([id, todo]) => todo && typeof todo === "object" ? { id, ...todo } : null)
      .filter((todo) => todo && typeof todo.text === "string" && todo.text.trim())
      .map((todo) => ({
        id: todo.id,
        text: todo.text.trim(),
        from: todoBears[todo.from] ? todo.from : "lewis",
        done: todo.done === true,
        at: Number(todo.at) || 0,
      }))
      .sort((first, second) => {
        if (first.done !== second.done) return Number(first.done) - Number(second.done);
        return second.at - first.at;
      });

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

todoPerson.textContent = validTodoUser ? "writing as " + todoName : "not signed in";
myBear.textContent = todoBears[todoName] || "🐻";

if (!validTodoUser) {
  disableTodoForm("go back home and sign in first");
}

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (!text || !validTodoUser || !todosRef) return;
  todoSubmit.disabled = true;
  try {
    await todosRef.push({
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
    todoSubmit.disabled = !validTodoUser;
  }
});

todoFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTodoFilter = button.dataset.filter;
    todoFilterButtons.forEach((filterButton) => {
      filterButton.setAttribute("aria-pressed", String(filterButton.dataset.filter === activeTodoFilter));
    });
    renderTodos();
  });
});

renderTodos();

if (firebaseConfig.databaseURL) {
  try {
    firebase.initializeApp(firebaseConfig);
    todosRef = firebase.database().ref("todos");
    subscribeToTodos();
  } catch (error) {
    console.error("firebase initialization failed:", error);
    disableTodoForm("couldn't connect to the todo database");
  }
} else {
  disableTodoForm("Firebase isn't configured yet");
}

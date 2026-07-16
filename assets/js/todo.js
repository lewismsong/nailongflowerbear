
Todo · JS
const todoName = (localStorage.getItem("ily:name") || "").trim().toLowerCase();
const todoBears = { khali: "🐻‍❄️", lewis: "🐻" };
const todoList = document.getElementById("todo-list");
const todoEmpty = document.getElementById("todo-empty");
const todoCount = document.getElementById("todo-count");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoSubmit = todoForm.querySelector("button");
const todoError = document.getElementById("todo-error");
const todoPerson = document.getElementById("todo-person");
const myBear = document.getElementById("my-bear");
const validTodoUser = Boolean(todoBears[todoName]);
const pendingSaves = new Map();
 
firebase.initializeApp(firebaseConfig);
const todosRef = firebase.database().ref("todos");
 
let todos = [];
let renderQueued = false;
 
function showTodoError(message) {
  todoError.textContent = message;
}
 
function isEditingText() {
  const active = document.activeElement;
  return Boolean(active && active.classList && active.classList.contains("todo-text"));
}
 
function flushQueuedRender() {
  if (!renderQueued) return;
  renderQueued = false;
  renderTodos();
}
 
// firebase: shared value subscription — both devices see the same list, live
todosRef.on("value", (snapshot) => {
  const value = snapshot.val() || {};
  todos = Object.entries(value)
    .map(([id, todo]) =>
      todo && typeof todo.text === "string" && todo.text.trim()
        ? {
            id,
            text: todo.text.trim(),
            from: todoBears[todo.from] ? todo.from : "lewis",
            done: todo.done === true,
            at: Number(todo.at) || 0,
          }
        : null
    )
    .filter(Boolean)
    .sort((first, second) => first.at - second.at);
  if (isEditingText()) {
    renderQueued = true; // don't yank the cursor while someone is mid-edit
    return;
  }
  renderTodos();
}, (error) => {
  console.error("todo subscription failed:", error);
  showTodoError("can't reach the shared list — check the connection (or the firebase rules)");
});
 
// firebase: per-item create, update, and delete operations
function updateTodo(id, changes) {
  return todosRef.child(id).update(changes).catch((error) => {
    console.error("todo update failed:", error);
    showTodoError("couldn't save that — check your connection");
    throw error;
  });
}
 
function removeTodo(id) {
  return todosRef.child(id).remove().catch((error) => {
    console.error("todo delete failed:", error);
    showTodoError("couldn't delete that — check your connection");
    throw error;
  });
}
 
function scheduleTextSave(id, textElement) {
  const previousTimer = pendingSaves.get(id);
  if (previousTimer) clearTimeout(previousTimer);
  const timer = setTimeout(() => {
    pendingSaves.delete(id);
    const text = textElement.textContent.trim();
    if (!text) return;
    updateTodo(id, { text })
      .then(() => { textElement.dataset.savedText = text; })
      .catch(() => {});
  }, 300);
  pendingSaves.set(id, timer);
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
  checkbox.addEventListener("change", () => {
    updateTodo(todo.id, { done: checkbox.checked }).catch(() => {
      checkbox.checked = !checkbox.checked;
    });
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
  text.addEventListener("blur", () => {
    const timer = pendingSaves.get(todo.id);
    if (timer) clearTimeout(timer);
    pendingSaves.delete(todo.id);
    const newText = text.textContent.trim();
    if (!newText) {
      text.textContent = text.dataset.savedText;
      showTodoError("a list item can't be empty — use × to remove it");
      flushQueuedRender();
      return;
    }
    if (newText !== text.dataset.savedText) {
      updateTodo(todo.id, { text: newText })
        .then(() => { text.dataset.savedText = newText; })
        .catch(() => { text.textContent = text.dataset.savedText; });
    }
    flushQueuedRender();
  });
 
  const removeButton = document.createElement("button");
  removeButton.className = "todo-delete";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", "delete todo");
  removeButton.addEventListener("click", () => {
    const timer = pendingSaves.get(todo.id);
    if (timer) clearTimeout(timer);
    pendingSaves.delete(todo.id);
    removeTodo(todo.id).catch(() => {});
  });
 
  item.classList.toggle("done", todo.done);
  item.append(checkbox, bear, text, removeButton);
  return item;
}
 
function renderTodos() {
  todoList.replaceChildren(...todos.map(createTodoItem));
  const openCount = todos.filter((todo) => !todo.done).length;
  todoCount.textContent = openCount + " open";
  todoEmpty.classList.toggle("hidden", todos.length > 0);
}
 
todoPerson.textContent = validTodoUser ? "writing as " + todoName : "not signed in";
myBear.textContent = todoBears[todoName] || "🐻";
 
if (!validTodoUser) {
  todoInput.disabled = true;
  todoSubmit.disabled = true;
  showTodoError("go back home and sign in first");
}
 
todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = todoInput.value.trim();
  if (!text || !validTodoUser) return;
  todosRef
    .push({
      text,
      from: todoName,
      done: false,
      at: firebase.database.ServerValue.TIMESTAMP,
    })
    .then(() => {
      todoInput.value = "";
      todoInput.focus();
      showTodoError("");
    })
    .catch((error) => {
      console.error("todo create failed:", error);
      showTodoError("couldn't add that — check your connection");
    });
});
 
renderTodos();

const TODO_STORAGE_KEY = "ily:todos";
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

function showTodoError(message) {
  todoError.textContent = message;
}

function loadTodos() {
  // firebase: replace this local read with a value subscription for shared live updates
  try {
    const storedTodos = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || "[]");
    if (!Array.isArray(storedTodos)) throw new Error("saved todos are not a list");
    return storedTodos
      .filter((todo) => todo && typeof todo.id === "string" && typeof todo.text === "string" && todo.text.trim())
      .map((todo) => ({
        id: todo.id,
        text: todo.text.trim(),
        from: todoBears[todo.from] ? todo.from : "lewis",
        done: todo.done === true,
        at: Number(todo.at) || 0,
      }))
      .sort((first, second) => first.at - second.at);
  } catch (error) {
    console.error("todo loading failed:", error);
    return [];
  }
}

let todos = loadTodos();

function saveTodos(nextTodos, shouldRender = true) {
  // firebase: replace this local write with create, update, and delete operations
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(nextTodos));
    todos = nextTodos;
    if (shouldRender) renderTodos();
    showTodoError("");
    return true;
  } catch (error) {
    console.error("todo saving failed:", error);
    showTodoError("couldn't save that on this device");
    return false;
  }
}

function updateTodo(id, changes, shouldRender = true) {
  const nextTodos = todos.map((todo) => todo.id === id ? { ...todo, ...changes } : todo);
  return saveTodos(nextTodos, shouldRender);
}

function scheduleTextSave(id, textElement) {
  const previousTimer = pendingSaves.get(id);
  if (previousTimer) clearTimeout(previousTimer);
  const timer = setTimeout(() => {
    pendingSaves.delete(id);
    const text = textElement.textContent.trim();
    if (!text) return;
    if (updateTodo(id, { text }, false)) textElement.dataset.savedText = text;
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
    if (!updateTodo(todo.id, { done: checkbox.checked })) checkbox.checked = !checkbox.checked;
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
      return;
    }
    if (newText === text.dataset.savedText) return;
    if (updateTodo(todo.id, { text: newText }, false)) text.dataset.savedText = newText;
    else text.textContent = text.dataset.savedText;
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
    saveTodos(todos.filter((itemTodo) => itemTodo.id !== todo.id));
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
  const newTodo = {
    id: crypto.randomUUID(),
    text,
    from: todoName,
    done: false,
    at: Date.now(),
  };
  if (saveTodos([...todos, newTodo])) {
    todoInput.value = "";
    todoInput.focus();
  }
});

renderTodos();

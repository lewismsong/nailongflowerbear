const bearTabs = [
  { id: "home", label: "misses", href: "index.html", icon: "🤍" },
  { id: "todo", label: "our list", href: "todo.html", image: "assets/images/bears.jpg" },
  { id: "coinflip", label: "coinflip", image: "assets/images/bear-with-flower.png" },
];

function createBearTab(tab, currentTab) {
  const element = tab.href ? document.createElement("a") : document.createElement("button");
  element.className = "bear-tab";

  if (tab.href) element.href = tab.href;
  else {
    element.type = "button";
    element.title = "coming soon";
  }

  if (tab.id === currentTab) {
    element.classList.add("active");
    element.setAttribute("aria-current", "page");
  }

  if (tab.image) {
    const image = document.createElement("img");
    image.className = "bear-tab-image";
    image.src = tab.image;
    image.alt = "";
    element.appendChild(image);
  } else {
    const icon = document.createElement("span");
    icon.className = "bear-tab-icon";
    icon.textContent = tab.icon;
    icon.setAttribute("aria-hidden", "true");
    element.appendChild(icon);
  }

  const label = document.createElement("span");
  label.className = "bear-tab-label";
  label.textContent = tab.label;
  element.appendChild(label);
  return element;
}

class BearTabNavigation extends HTMLElement {
  connectedCallback() {
    if (this.firstChild) return;

    const navigation = document.createElement("nav");
    navigation.className = "bear-tab-bar";
    navigation.setAttribute("aria-label", "main navigation");
    const currentTab = this.getAttribute("current");

    for (const tab of bearTabs) navigation.appendChild(createBearTab(tab, currentTab));
    this.appendChild(navigation);
  }
}

customElements.define("bear-tab-nav", BearTabNavigation);

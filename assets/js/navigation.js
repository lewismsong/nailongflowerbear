const bearTabs = [
  { id: "home", label: "misses", href: "index.html", icon: "🤍" },
  { id: "todo", label: "our list", href: "todo.html", image: "assets/images/bears.jpg" },
  { id: "coinflip", label: "coinflip", href: "coinflip.html?v=5", image: "assets/images/bear-with-flower.png" },
  { id: "cities", label: "world map", href: "cities.html", image: "assets/images/bears-sitting-lake.png" },
  { id: "trips", label: "trips", href: "trips.html", image: "assets/images/bears-airport.png" },
  { id: "pakku", label: "pakku’s house", href: "pakku.html", image: "assets/images/pakku.png" },
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
    this.handleAuthenticationChange = () => this.render();
    window.addEventListener("app-auth-changed", this.handleAuthenticationChange);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("app-auth-changed", this.handleAuthenticationChange);
  }

  render() {
    this.replaceChildren();
    this.hidden = !isAppAuthenticated();
    if (this.hidden) return;

    const navigation = document.createElement("nav");
    navigation.className = "bear-tab-bar";
    navigation.setAttribute("aria-label", "main navigation");
    const currentTab = this.getAttribute("current");

    for (const tab of bearTabs) navigation.appendChild(createBearTab(tab, currentTab));

    const brand = document.createElement("button");
    brand.type = "button";
    brand.className = "trademark bear-tab-brand";
    brand.setAttribute("aria-label", "adjust all-time misses");
    brand.textContent = "lewiskhalico™";
    this.append(navigation, brand);
  }
}

customElements.define("bear-tab-nav", BearTabNavigation);

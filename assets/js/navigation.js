const bearTabs = [
  { id: "home", label: "misses", href: "index.html", icon: "🤍" },
  { id: "todo", label: "our list", href: "todo.html", image: "assets/images/bears.jpg" },
  { id: "coinflip", label: "coinflip", href: "coinflip.html?v=5", image: "assets/images/bear-with-flower.webp" },
  { id: "cities", label: "world map", href: "cities.html", image: "assets/images/bears-airport.webp" },
  { id: "pakku", label: "pakku’s house", href: "pakku.html", image: "assets/images/pakku.webp" },
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
    const floor = document.createElement("div");
    floor.className = "carousel-floor";
    floor.setAttribute("aria-hidden", "true");
    const leaves = [
      [4, 9, -34, "#C47740"], [18, 2, 28, "#D5A344"],
      [37, 16, -68, "#AB5841"], [58, 6, 46, "#DB9554"],
      [76, 17, -24, "#AA8547"], [91, 3, 72, "#C46747"]
    ];
    for (const [x, y, turn, color] of leaves) {
      const leaf = document.createElement("span");
      leaf.className = "floor-leaf";
      leaf.style.setProperty("--leaf-x", x + "%");
      leaf.style.setProperty("--leaf-y", y + "px");
      leaf.style.setProperty("--leaf-turn", turn + "deg");
      leaf.style.setProperty("--leaf-color", color);
      floor.appendChild(leaf);
    }
    const birthdayNote = document.createElement("p");
    birthdayNote.className = "pakku-birthday-note";
    birthdayNote.textContent = "happy birthday, pakku! 🎂";
    this.append(birthdayNote, navigation, floor, brand);
  }
}

customElements.define("bear-tab-nav", BearTabNavigation);

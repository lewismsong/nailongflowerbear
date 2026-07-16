const coinButton = document.getElementById("coin");
const coin = coinButton.querySelector(".coin");
const coinResult = document.getElementById("coin-result");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let coinRotation = 0;
let coinIsFlipping = false;
let finishTimer = null;

function randomBear() {
  if (!window.crypto?.getRandomValues) throw new Error("secure randomness is unavailable");
  const randomValue = new Uint32Array(1);
  window.crypto.getRandomValues(randomValue);
  return randomValue[0] % 2 === 0 ? "white" : "brown";
}

function flipCoin() {
  if (coinIsFlipping) return;

  try {
    const result = randomBear();
    const sideRotation = result === "brown" ? 180 : 0;
    const nextFullTurn = Math.ceil(coinRotation / 360) * 360;
    coinRotation = nextFullTurn + 5 * 360 + sideRotation;
    coinIsFlipping = true;
    coinButton.disabled = true;
    coinButton.classList.add("flipping");
    coinButton.setAttribute("aria-label", "coin is flipping");
    coinResult.classList.add("waiting");
    coinResult.textContent = "flipping...";
    coin.style.transform = "rotateY(" + coinRotation + "deg)";

    const finishFlip = () => {
      window.clearTimeout(finishTimer);
      coin.removeEventListener("transitionend", finishFlip);
      coinIsFlipping = false;
      coinButton.disabled = false;
      coinButton.classList.remove("flipping");
      coinButton.setAttribute("aria-label", "flip the coin");
      coinResult.classList.remove("waiting");
      coinResult.textContent = result === "white" ? "🐻‍❄️!" : "🐻!";
    };

    coin.addEventListener("transitionend", finishFlip, { once: true });
    const flipDuration = reducedMotion.matches ? 450 : 1550;
    finishTimer = window.setTimeout(finishFlip, flipDuration);
  } catch (error) {
    console.error("coin flip failed:", error);
    coinResult.textContent = "couldn't flip — try again";
  }
}

coinButton.addEventListener("click", flipCoin);

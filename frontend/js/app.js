import { createApiClient } from "./api.js";

const output = document.getElementById("api-output");
const baseInput = document.getElementById("api-base-input");

function show(data) {
  output.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function client() {
  return createApiClient(baseInput.value.trim());
}

document.getElementById("btn-health").addEventListener("click", async () => {
  try {
    show(await client().health());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

document.getElementById("btn-ping").addEventListener("click", async () => {
  try {
    show(await client().ping());
  } catch (e) {
    show(`Error: ${e.message}\n${e.body != null ? JSON.stringify(e.body, null, 2) : ""}`);
  }
});

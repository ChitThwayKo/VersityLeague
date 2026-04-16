import { API_BASE_URL } from "./config.js";

async function checkApiHealth() {
  const url = `${API_BASE_URL}/api/v1/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    console.info("[Versity League] API:", data);
  } catch {
    // Backend may be offline during static-only development — expected.
  }
}

checkApiHealth();

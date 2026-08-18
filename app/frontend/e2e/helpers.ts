/**
 * e2e helpers — seed/clean data through the backend API so the UI tests
 * can assert against a known dataset without relying on a pre-populated DB.
 */
export const API = process.env.E2E_API_URL || "http://127.0.0.1:8000/api/v1";

export async function apiPost(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

export async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

/** Wipe business data (keeps settings). Call before seeding in each test. */
export async function resetData(): Promise<void> {
  await fetch(`${API}/maintenance/reset-all-data`, { method: "POST" });
}

/** Create a property, returning its id. */
export async function seedProperty(name = "E2E Villa"): Promise<string> {
  const prop = await apiPost("/properties", {
    name,
    city: "Lisbon",
    country: "Portugal",
    bedrooms: 2,
    bathrooms: 1,
    max_guests: 4,
    target_annual_revenue: 20000,
  });
  return prop.id as string;
}

/** Add a revenue record for a property (this year). */
export async function seedRevenue(
  propertyId: string,
  date: string,
  gross: number,
  commission = gross * 0.1,
  source = "airbnb",
): Promise<void> {
  await apiPost("/finance/revenue", {
    property_id: propertyId,
    date,
    gross_amount: gross,
    commission_amount: commission,
    source,
    currency: "EUR",
  });
}

/** Add an expense record for a property. */
export async function seedExpense(
  propertyId: string,
  date: string,
  amount: number,
  description = "Cleaning",
): Promise<void> {
  await apiPost("/finance/expense", {
    property_id: propertyId,
    date,
    amount,
    currency: "EUR",
    description,
  });
}

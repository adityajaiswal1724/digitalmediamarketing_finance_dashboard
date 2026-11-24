import type { Employee, ManagedAccount, Session } from './access';
import type { Client, Division } from './model';
import type { Invoice } from './model';
import type { CreditNote } from './credit-notes';

// This portfolio build is intentionally isolated from production services.
export const apiEnabled = false;

export type LoginChoice = 'admin' | 'employee' | 'ca';

export interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: LoginChoice;
  department: Division | null;
  passwordChangeRequired: boolean;
  sessionExpiresAt?: string;
  impersonatedBy?: {
    id: string;
    username: string;
    displayName: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(_path: string, _init: RequestInit = {}, _binary = false): Promise<T> {
  throw new ApiError('This browser-local demo does not connect to a production API.', 400);
}

export function sessionFromUser(user: ApiUser): Session {
  return user.role === 'admin'
    ? { role: 'admin' }
    : user.role === 'ca'
      ? { role: 'ca', accountId: user.id }
      : { role: 'employee', employeeId: user.id };
}

export function employeeFromUser(user: ApiUser): Employee | null {
  if (user.role !== 'employee' || !user.department) return null;
  return {
    id: user.id,
    name: user.username,
    password: '',
    department: user.department,
    active: true,
  };
}

export async function login(username: string, password: string) {
  return request<{ user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return request<{ user: ApiUser }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function requestPasswordReset(identifier: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function updateProfileEmail(email: string, currentPassword: string) {
  return request<{ user: ApiUser }>('/auth/profile/email', {
    method: 'POST',
    body: JSON.stringify({ email, currentPassword }),
  });
}

// Keep the same key after an ambiguous network/server failure, so a retry cannot duplicate a document.
const pendingCreates = new Map<string, string>();
async function createDocument<T>(path: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${path}:${body}`));
  const operation =
    'demo-pending-' +
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let key = pendingCreates.get(operation);
  try {
    key = sessionStorage.getItem(operation) ?? key;
  } catch {
    /* Storage can be disabled. */
  }
  key ??= crypto.randomUUID();
  pendingCreates.set(operation, key);
  try {
    sessionStorage.setItem(operation, key);
  } catch {
    /* Keep the in-memory retry key. */
  }
  const result = await request<T>(path, {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': key },
  });
  pendingCreates.delete(operation);
  try {
    sessionStorage.removeItem(operation);
  } catch {
    /* Storage can be disabled. */
  }
  return result;
}

export async function getSession() {
  return request<{ user: ApiUser }>('/auth/session');
}

export async function logout() {
  return request<void>('/auth/logout', { method: 'POST' });
}

export async function impersonateAccount(accountId: string) {
  return request<{ user: ApiUser }>(`/auth/impersonate/${accountId}`, { method: 'POST' });
}

export async function stopImpersonation() {
  return request<{ user: ApiUser }>('/auth/impersonation/stop', { method: 'POST' });
}

export async function listClients() {
  return request<Client[]>('/clients');
}

export async function createClient(client: Client) {
  const { id: _id, pan: _pan, ...payload } = client;
  return request<Client>('/clients', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateClient(client: Client) {
  const { id, pan: _pan, ...payload } = client;
  return request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

type ApiEmployee = Omit<Employee, 'password'> | Omit<import('./access').CaAccount, 'password'>;
const toEmployee = (employee: ApiEmployee): ManagedAccount => ({ ...employee, password: '' });

export async function listEmployees() {
  return (await request<ApiEmployee[]>('/employees')).map(toEmployee);
}

export async function createEmployee(employee: ManagedAccount) {
  const result = await request<ApiEmployee>('/employees', {
    method: 'POST',
    body: JSON.stringify({
      name: employee.name,
      role: employee.role || 'employee',
      password: employee.password,
      ...(employee.role !== 'ca' ? { department: employee.department } : {}),
    }),
  });
  return toEmployee(result);
}

export async function updateEmployee(employee: ManagedAccount) {
  const result = await request<ApiEmployee>(`/employees/${employee.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: employee.name,
      ...(employee.password ? { password: employee.password } : {}),
      ...(employee.role !== 'ca' ? { department: employee.department } : {}),
      active: employee.active,
    }),
  });
  return toEmployee(result);
}

export async function setEmployeeActive(employee: ManagedAccount, active: boolean) {
  const result = await request<ApiEmployee>(`/employees/${employee.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
  return toEmployee(result);
}

const invoicePayload = (invoice: Invoice) => ({
  clientId: invoice.client.id,
  date: invoice.date,
  billFromGst: invoice.billFromGst || '07-DEMO-GST',
  poRoNumber: invoice.poRoNumber,
  currency: invoice.currency || 'INR',
  campaigns: invoice.campaigns.map(
    ({ division, month, name, units, rate, exchangeRateEnabled, exchangeRate }) => ({
      division,
      month,
      name,
      units,
      rate,
      exchangeRateEnabled,
      exchangeRate,
    }),
  ),
});

export async function listInvoices() {
  return request<Invoice[]>('/invoices');
}

export async function getInvoiceChronology() {
  return request<{ minimumDate: string }>('/invoices/chronology');
}

export async function createInvoice(invoice: Invoice) {
  return createDocument<Invoice>('/invoices', invoicePayload(invoice));
}

export async function updateInvoice(invoice: Invoice) {
  return request<Invoice>('/invoices', {
    method: 'PUT',
    body: JSON.stringify({
      invoiceNumber: invoice.id,
      expectedVersion: invoice.version,
      ...invoicePayload(invoice),
    }),
  });
}

export async function setInvoicePaymentStatus(
  invoiceId: string,
  status: 'Y' | 'N',
  expectedVersion: number | undefined,
) {
  return request<Invoice>('/invoices/payment-status', {
    method: 'PATCH',
    body: JSON.stringify({ invoiceNumber: invoiceId, status, expectedVersion }),
  });
}

const creditNotePayload = (creditNote: CreditNote) => ({
  invoiceId: creditNote.invoiceId,
  date: creditNote.date,
  mode: creditNote.mode,
  value: creditNote.value,
});

export async function listCreditNotes() {
  return request<CreditNote[]>('/credit-notes');
}

export async function createCreditNote(creditNote: CreditNote) {
  return createDocument<CreditNote>('/credit-notes', creditNotePayload(creditNote));
}

export async function updateCreditNote(creditNote: CreditNote) {
  return request<CreditNote>('/credit-notes', {
    method: 'PUT',
    body: JSON.stringify({
      creditNoteNumber: creditNote.id,
      expectedVersion: creditNote.version,
      ...creditNotePayload(creditNote),
    }),
  });
}

export function getInvoicePdf(invoiceNumber: string) {
  return request<Blob>(
    `/invoices/pdf?invoiceNumber=${encodeURIComponent(invoiceNumber)}`,
    {},
    true,
  );
}
export function getCreditNotePdf(creditNoteNumber: string, original = false) {
  return request<Blob>(
    `/credit-notes/pdf?creditNoteNumber=${encodeURIComponent(creditNoteNumber)}&original=${original}`,
    {},
    true,
  );
}
export function exportInvoiceCsv(filters: Record<string, string>) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return request<Blob>(`/invoices/export.csv?${params}`, {}, true);
}

export function setInvoicePayments(invoice: Invoice, paymentsReceived: number) {
  return request<Invoice>('/invoices/payments', {
    method: 'PATCH',
    body: JSON.stringify({
      invoiceNumber: invoice.id,
      expectedVersion: invoice.version,
      paymentsReceived,
    }),
  });
}

export function exportAccountingCsv(financialYear: string, month: string) {
  const params = new URLSearchParams({ financialYear });
  if (month) params.set('month', month);
  return request<Blob>(`/reports/accounting.csv?${params}`, {}, true);
}

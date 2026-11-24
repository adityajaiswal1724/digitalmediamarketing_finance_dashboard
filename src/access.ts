import type { Division, Invoice } from './model';

export type Employee = {
  role?: 'employee';
  id: string;
  name: string;
  password: string;
  department: Division;
  active: boolean;
};
export type CaAccount = Omit<Employee, 'role' | 'department'> & { role: 'ca'; department: null };
export type ManagedAccount = Employee | CaAccount;
export type Session =
  { role: 'admin' } | { role: 'employee'; employeeId: string } | { role: 'ca'; accountId: string };
export const initialEmployees: Employee[] = [
  {
    id: 'emp1',
    name: 'emp1',
    password: 'emp@1234',
    department: 'CPS',
    active: true,
  },
  {
    id: 'emp2',
    name: 'emp2',
    password: 'emp@1234',
    department: 'CPL',
    active: true,
  },
  {
    id: 'emp3',
    name: 'emp3',
    password: 'emp@1234',
    department: 'Mobile',
    active: true,
  },
];
export function authenticate(
  id: string,
  password: string,
  employees: ManagedAccount[],
): Session | null {
  if (id === 'admin' && password === 'admin@1234') return { role: 'admin' };
  const employee = employees.find((e) => e.active && e.name === id && e.password === password);
  return employee
    ? employee.role === 'ca'
      ? { role: 'ca', accountId: employee.id }
      : { role: 'employee', employeeId: employee.id }
    : null;
}
export function employeeNameAvailable(
  name: string,
  employees: ManagedAccount[],
  exceptId?: string,
) {
  const normalized = name.trim().toLowerCase();
  return (
    Boolean(normalized) &&
    normalized !== 'admin' &&
    !employees.some((e) => e.id !== exceptId && e.name.toLowerCase() === normalized)
  );
}
export function employeeInvoiceHistory(invoices: Invoice[], employee: Employee): Invoice[] {
  return invoices.filter(
    (invoice) =>
      invoice.createdByEmployeeId === employee.id &&
      invoice.campaigns.every((campaign) => campaign.division === employee.department),
  );
}
export function invoiceCreatorName(invoice: Invoice, employees: ManagedAccount[]) {
  if (invoice.createdByName) return invoice.createdByName;
  if (!invoice.createdByEmployeeId) return 'Admin';
  return (
    employees.find((employee) => employee.id === invoice.createdByEmployeeId)?.name ||
    invoice.createdByEmployeeId
  );
}

export const initialAccounts: ManagedAccount[] = [...initialEmployees, { id: 'ca1', name: 'ca1', password: 'ca@1234', role: 'ca', department: null, active: true }];

import { describe, it, expect } from 'vitest';
import {
  authenticate,
  employeeInvoiceHistory,
  employeeNameAvailable,
  initialEmployees,
  invoiceCreatorName,
} from './access';
import { initialInvoices } from './model';

describe('demo employee access', () => {
  it('signs in the three seed employees with their assigned departments', () => {
    expect(initialEmployees.map((e) => [e.name, e.department])).toEqual([
      ['emp1', 'CPS'],
      ['emp2', 'CPL'],
      ['emp3', 'Mobile'],
    ]);
    expect(authenticate('emp1', 'emp@1234', initialEmployees)).toEqual({
      role: 'employee',
      employeeId: 'emp1',
    });
  });
  it('rejects wrong passwords and disabled employees', () => {
    expect(authenticate('emp2', 'wrong', initialEmployees)).toBeNull();
    expect(
      authenticate(
        'emp2',
        'emp@1234',
        initialEmployees.map((e) => (e.id === 'emp2' ? { ...e, active: false } : e)),
      ),
    ).toBeNull();
  });
  it('reserves admin and prevents duplicate login names', () => {
    expect(employeeNameAvailable('admin', initialEmployees)).toBe(false);
    expect(employeeNameAvailable('EMP1', initialEmployees)).toBe(false);
    expect(employeeNameAvailable('emp4', initialEmployees)).toBe(true);
    expect(employeeNameAvailable('emp1', initialEmployees, 'emp1')).toBe(true);
  });
  it('shows only invoices created by the employee in their assigned department', () => {
    const cps = initialInvoices.find((invoice) => invoice.campaigns[0].division === 'CPS')!;
    const cpl = initialInvoices.find((invoice) => invoice.campaigns[0].division === 'CPL')!;
    const invoices = [
      cps,
      { ...cps, id: 'own-cps', createdByEmployeeId: 'emp1' },
      { ...cpl, id: 'own-old-department', createdByEmployeeId: 'emp1' },
      { ...cps, id: 'other-employee', createdByEmployeeId: 'emp2' },
    ];
    expect(
      employeeInvoiceHistory(invoices, initialEmployees[0]).map((invoice) => invoice.id),
    ).toEqual(['own-cps']);
  });
  it('labels employee-created invoices with the username and admin invoices as Admin', () => {
    const invoice = initialInvoices[0];
    expect(invoiceCreatorName(invoice, initialEmployees)).toBe('Admin');
    expect(invoiceCreatorName({ ...invoice, createdByEmployeeId: 'emp2' }, initialEmployees)).toBe(
      'emp2',
    );
  });
});

describe('CA demo access', () => {
  it('authenticates managed CA accounts separately and honours disabled access', () => {
    const ca = {
      id: 'ca1',
      name: 'accountant',
      role: 'ca' as const,
      department: null,
      password: 'Example-Password-123',
      active: true,
    };
    expect(authenticate(ca.name, ca.password, [ca])).toEqual({ role: 'ca', accountId: ca.id });
    expect(authenticate(ca.name, ca.password, [{ ...ca, active: false }])).toBeNull();
    expect(employeeNameAvailable(ca.name, [ca])).toBe(false);
  });
});

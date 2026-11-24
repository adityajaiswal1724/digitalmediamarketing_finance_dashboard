import { ArrowRight, FileText, ReceiptText, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { type Employee } from '../../access';
import { dateLabel, monthLabel } from '../../lib/format';
import { invoiceTotals, money, type Invoice } from '../../model';

export function EmployeeWorkspace({
  employee,
  invoices,
  onAddClient,
  onInvoice,
  onPreview,
}: {
  employee: Employee;
  invoices: Invoice[];
  onAddClient: () => void;
  onInvoice: () => void;
  onPreview: (invoice: Invoice) => void;
}) {
  const historyRef = useRef<HTMLElement>(null);
  const history = [...invoices].reverse();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <span className="eyebrow">EMPLOYEE WORKSPACE</span>
      <h1>
        Welcome, {employee.name}
        <span className="heading-dot">.</span>
      </h1>
      <p className="employee-intro">
        Your assigned department is <strong>{employee.department}</strong>. Choose what you need to
        do.
      </p>
      <div className="employee-actions">
        <button onClick={onAddClient}>
          <span>
            <Users size={25} />
          </span>
          <strong>Add Client</strong>
          <small>Save a new client and their contact details.</small>
          <ArrowRight size={19} />
        </button>
        <button onClick={onInvoice}>
          <span>
            <FileText size={25} />
          </span>
          <strong>Generate Invoice</strong>
          <small>Create an invoice for the {employee.department} department.</small>
          <ArrowRight size={19} />
        </button>
        <button
          onClick={() =>
            historyRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }
        >
          <span>
            <ReceiptText size={25} />
          </span>
          <strong>Invoice History</strong>
          <small>View invoices you generated in {employee.department}.</small>
          <ArrowRight size={19} />
        </button>
      </div>
      <section className="panel employee-history" ref={historyRef} aria-label="Invoice History">
        <div className="history-heading">
          <div>
            <h2>
              Invoice History <span className="count-badge">{history.length}</span>
            </h2>
            <p>Invoices you generated for the {employee.department} department.</p>
          </div>
        </div>
        {history.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice number</th>
                  <th>Client name</th>
                  <th>Invoice date</th>
                  <th>Activity month</th>
                  <th>Base amount</th>
                  <th>Grand total</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {history.map((invoice) => {
                  const amount = invoiceTotals(invoice);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <button className="invoice-link" onClick={() => onPreview(invoice)}>
                          {invoice.id}
                        </button>
                      </td>
                      <td>{invoice.client.name}</td>
                      <td>{dateLabel(invoice.date)}</td>
                      <td>
                        {[
                          ...new Set(
                            invoice.campaigns.map((campaign) => monthLabel(campaign.month)),
                          ),
                        ].join(', ')}
                      </td>
                      <td className="numeric">{money(amount.base, invoice.currency || 'INR')}</td>
                      <td className="numeric total-cell">
                        {money(amount.total, invoice.currency || 'INR')}
                      </td>
                      <td>{invoice.currency || 'INR'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <FileText size={25} />
            <h3>No invoices yet</h3>
            <p>Invoices you generate will appear here.</p>
          </div>
        )}
      </section>
    </motion.div>
  );
}

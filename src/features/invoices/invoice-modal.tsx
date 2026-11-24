import { PageGuide } from '../../components/demo-guide';
import { apiEnabled } from '../../api';
import { Check, ChevronDown, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { currencyOptions, defaultCurrencyForCountry } from '../../currency';
import { dateLabel } from '../../lib/format';
import {
  campaignRate,
  canEditInvoice,
  demoGstRegistrations,
  defaultDemoGst,
  invoiceEditDeadline,
  latestDate,
  localDate,
  money,
  nextInvoiceId,
  totals,
  validInvoice,
  validInvoiceDetails,
  type Campaign,
  type Client,
  type DemoGstNumber,
  type Division,
  type Invoice,
} from '../../model';

export function InvoiceModal({
  clients,
  invoices,
  minimumDate,
  invoice,
  fixedDivision,
  onClose,
  onCreate,
}: {
  clients: Client[];
  invoices: Invoice[];
  minimumDate?: string;
  invoice?: Invoice;
  fixedDivision?: Division;
  onClose: () => void;
  onCreate: (i: Invoice) => void | Promise<void>;
}) {
  const earliestInvoiceDate = minimumDate || latestDate(invoices);
  const initialMonth = (invoice?.date || earliestInvoiceDate || localDate()).slice(0, 7);
  const [clientId, setClientId] = useState(invoice?.client.id || '');
  const [search, setSearch] = useState(invoice?.client.name || '');
  const [clientListOpen, setClientListOpen] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(-1);
  const clientPickerRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(
    invoice?.date || [earliestInvoiceDate, localDate()].sort().at(-1) || localDate(),
  );
  const [division, setDivision] = useState<Division>(
    fixedDivision || invoice?.campaigns[0]?.division || 'Mobile',
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>(
    invoice
      ? invoice.campaigns.map(
          ({ appliedRate: _applied, baseAmount: _base, ...campaign }) => campaign,
        )
      : [
          {
            division: fixedDivision || 'Mobile',
            month: initialMonth,
            name: '',
            units: 0,
            rate: 0,
          },
        ],
  );
  const [currency, setCurrency] = useState(
    invoice?.currency || defaultCurrencyForCountry(invoice?.client.country || ''),
  );
  const [poRoNumber, setPoRoNumber] = useState(invoice?.poRoNumber || '');
  const [billFromGst, setBillFromGst] = useState<DemoGstNumber>(
    invoice?.billFromGst || defaultDemoGst,
  );
  const [gstMenuOpen, setGstMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const client =
    clients.find((c) => c.id === clientId) ||
    (invoice?.client.id === clientId ? invoice.client : undefined);
  const isInternational = Boolean(client && client.country && client.country !== 'India');
  const displayCurrency = isInternational ? currency : 'INR';
  const t = totals(
    campaigns,
    client?.state || '',
    client?.country || 'India',
    billFromGst,
    displayCurrency,
    client?.stateCode || '',
  );
  const matches = [...clients]
    .filter((c) => c.name.toLocaleLowerCase().startsWith(search.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  useEffect(() => {
    function closeOnOutsideClick(e: PointerEvent) {
      if (!clientPickerRef.current?.contains(e.target as Node)) setClientListOpen(false);
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);
  function selectClient(c: Client) {
    setClientId(c.id);
    setSearch(c.name);
    setCurrency(defaultCurrencyForCountry(c.country));
    setClientListOpen(false);
    setActiveClientIndex(-1);
    setError('');
  }
  function onClientKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setClientListOpen(true);
      setActiveClientIndex((n) => Math.min(n + 1, matches.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setClientListOpen(true);
      setActiveClientIndex((n) => Math.max(n - 1, 0));
    }
    if (
      e.key === 'Enter' &&
      clientListOpen &&
      activeClientIndex >= 0 &&
      matches[activeClientIndex]
    ) {
      e.preventDefault();
      selectClient(matches[activeClientIndex]);
    }
    if (e.key === 'Escape') {
      setClientListOpen(false);
      setActiveClientIndex(-1);
    }
  }
  function update(index: number, key: keyof Campaign, value: string | number | boolean) {
    setCampaigns((prev) => prev.map((c, idx) => (idx === index ? { ...c, [key]: value } : c)));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!client) {
      setError('Select a client for this invoice.');
      return;
    }
    if (invoice && !canEditInvoice(invoice)) {
      setError('This invoice is locked after the 5th of the following month.');
      return;
    }
    const err = invoice
      ? validInvoiceDetails(date, campaigns)
      : date < earliestInvoiceDate
        ? 'Invoice date cannot be earlier than the last invoice date.'
        : validInvoice(date, invoices, campaigns);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({
        ...invoice,
        financials: undefined,
        id: invoice?.id || nextInvoiceId(invoices, date),
        date,
        billFromGst,
        poRoNumber: poRoNumber.trim() || undefined,
        client: { ...client },
        campaigns: campaigns.map((c) =>
          client.country === 'India'
            ? { ...c, division: fixedDivision || division }
            : {
                ...c,
                division: fixedDivision || division,
                exchangeRateEnabled: false,
                exchangeRate: undefined,
              },
        ),
        currency: client.country === 'India' ? 'INR' : currency,
        editDeadline: invoice?.editDeadline || invoiceEditDeadline(invoice?.date || date),
        taxOverride: undefined,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the invoice.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      wide
      className="invoice-modal"
      title={invoice ? 'Edit invoice' : 'Create an invoice'}
      description={
        invoice
          ? `Changes to ${invoice.id} are allowed through ${dateLabel(invoice.editDeadline || invoiceEditDeadline(invoice.date))}.`
          : 'One client. All your campaigns. One clear invoice.'
      }
      onClose={onClose}
      headerAction={
        <div className="invoice-gst-picker">
          <button
            type="button"
            className="button outline gst-picker-button"
            aria-haspopup="listbox"
            aria-expanded={gstMenuOpen}
            onClick={() => setGstMenuOpen((open) => !open)}
          >
            <span>
              Choose GST
              <small>{billFromGst}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {gstMenuOpen && (
            <div className="gst-picker-menu" role="listbox" aria-label="Choose GST">
              {demoGstRegistrations.map((registration) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={billFromGst === registration.gst}
                  key={registration.gst}
                  onClick={() => {
                    setBillFromGst(registration.gst);
                    setGstMenuOpen(false);
                  }}
                >
                  <span>
                    <strong>{registration.label}</strong>
                    <small>{registration.gst}</small>
                  </span>
                  {billFromGst === registration.gst && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <form onSubmit={submit}>
        {invoice && (
          <p className="field-hint">
            If this invoice has credit notes, review and update them separately after saving. Their
            amounts will not change automatically.
          </p>
        )}
        <div className="invoice-section">
          <div className="section-label">
            <span>01</span>Invoice details{' '}
            <small>
              {invoice?.id ||
                (apiEnabled
                  ? 'Number assigned on save'
                  : nextInvoiceId(invoices, date || latestDate(invoices)))}
            </small>
          </div>
          <div className="invoice-details-grid">
            <div className="client-field">
              <label htmlFor="invoice-client-search">Client name</label>
              <div className="client-picker" ref={clientPickerRef}>
                <div className="search-field">
                  <Search size={16} />
                  <input
                    id="invoice-client-search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={clientListOpen}
                    aria-controls="invoice-client-options"
                    aria-activedescendant={
                      clientListOpen && activeClientIndex >= 0
                        ? `invoice-client-option-${activeClientIndex}`
                        : undefined
                    }
                    autoComplete="off"
                    value={search}
                    onFocus={() => setClientListOpen(true)}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setClientId('');
                      setActiveClientIndex(-1);
                      setClientListOpen(true);
                      setError('');
                    }}
                    onKeyDown={onClientKeyDown}
                    placeholder="Type a client name…"
                  />
                  <ChevronDown
                    size={15}
                    className={clientListOpen ? 'picker-chevron open' : 'picker-chevron'}
                  />
                </div>
                {clientListOpen && (
                  <div
                    id="invoice-client-options"
                    role="listbox"
                    aria-label="Matching clients"
                    className="client-options"
                  >
                    {matches.length ? (
                      matches.map((c, index) => (
                        <button
                          id={`invoice-client-option-${index}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeClientIndex}
                          className={index === activeClientIndex ? 'active' : ''}
                          key={c.id}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectClient(c)}
                        >
                          <span>
                            {c.name}
                            {c.entityName && c.entityName !== c.name ? ` · ${c.entityName}` : ''}
                          </span>
                          {clientId === c.id && <Check size={15} />}
                        </button>
                      ))
                    ) : (
                      <div className="client-option-empty">
                        No clients start with “{search.trim()}”
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <label className="date-field">
              Invoice date
              <input
                type="date"
                required
                min={invoice ? undefined : earliestInvoiceDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {!invoice && earliestInvoiceDate && (
                <small className="field-hint">Earliest: {dateLabel(earliestInvoiceDate)}</small>
              )}
            </label>
            <label className="division-field">
              Division
              {fixedDivision ? (
                <input value={fixedDivision} readOnly aria-label="Assigned department" />
              ) : (
                <select
                  value={division}
                  onChange={(e) => {
                    const next = e.target.value as Division;
                    setDivision(next);
                    setCampaigns((prev) => prev.map((c) => ({ ...c, division: next })));
                  }}
                >
                  {(['CPL', 'CPS', 'Mobile'] as Division[]).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              )}
            </label>
            <label className="state-field">
              State
              <input readOnly value={client?.state || ''} placeholder="Filled from client" />
            </label>
            <label className="state-code-field">
              State code
              <input readOnly value={client?.stateCode || ''} placeholder="Filled from client" />
            </label>
          </div>
        </div>
        <div className="invoice-section">
          <div className="section-label campaign-section-label">
            <span>02</span>Campaigns{' '}
            <small>
              {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
            </small>
            <button
              type="button"
              className="campaign-add-trigger"
              aria-label="Add Campaign"
              title="Add Campaign"
              onClick={() =>
                setCampaigns((prev) => [
                  ...prev,
                  {
                    division: fixedDivision || division,
                    month: initialMonth,
                    name: '',
                    units: 0,
                    rate: 0,
                  },
                ])
              }
            >
              <span className="plus-bubble">
                <Plus size={18} />
              </span>
              <span className="campaign-add-text">Add Campaign</span>
            </button>
          </div>
          <div className="campaign-list">
            {campaigns.map((c, idx) => (
              <div className="campaign-card" key={idx}>
                <div className="campaign-heading">
                  <h3>Campaign {String(idx + 1).padStart(2, '0')}</h3>
                  {campaigns.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove campaign ${idx + 1}`}
                      onClick={() => setCampaigns((prev) => prev.filter((_, n) => n !== idx))}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div
                  className={`invoice-campaign-grid ${idx === 0 ? 'with-po' : ''} ${isInternational && idx === 0 ? 'international' : ''} ${!isInternational && c.exchangeRateEnabled ? 'with-exchange' : ''}`}
                >
                  <label>
                    <span className="campaign-field-label">Campaign name</span>
                    <input
                      required
                      value={c.name}
                      onChange={(e) => update(idx, 'name', e.target.value)}
                      placeholder="e.g. Demo acquisition campaign"
                    />
                  </label>
                  <label>
                    <span className="campaign-field-label">Activity month &amp; year</span>
                    <input
                      type="month"
                      required
                      value={c.month}
                      onChange={(e) => update(idx, 'month', e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="campaign-field-label">Unit</span>
                    <input
                      type="number"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={c.units || ''}
                      onChange={(e) => update(idx, 'units', Number(e.target.value))}
                      placeholder="0"
                    />
                  </label>
                  <div className="rate-field">
                    <div className="rate-label-row">
                      <label htmlFor={`campaign-rate-${idx}`}>
                        Rate per unit ({displayCurrency})
                      </label>
                      {client && !isInternational && (
                        <label className="exchange-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(c.exchangeRateEnabled)}
                            onChange={(e) => {
                              update(idx, 'exchangeRateEnabled', e.target.checked);
                              if (e.target.checked && !c.exchangeRate)
                                update(idx, 'exchangeRate', 0);
                            }}
                          />
                          Exchange Rate
                        </label>
                      )}
                    </div>
                    <input
                      id={`campaign-rate-${idx}`}
                      type="number"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={c.rate || ''}
                      onChange={(e) => update(idx, 'rate', Number(e.target.value))}
                      placeholder="0.00"
                    />
                    {client && !isInternational && c.exchangeRateEnabled && (
                      <small className="converted-rate">
                        New Rate per Unit: {money(campaignRate(c), 'INR')}
                      </small>
                    )}
                  </div>
                  {idx === 0 && (
                    <label className="po-ro-field">
                      <span className="campaign-field-label">PO/RO Number</span>
                      <input
                        value={poRoNumber}
                        onChange={(e) => setPoRoNumber(e.target.value)}
                        placeholder="e.g. PO-00286"
                      />
                    </label>
                  )}
                  {client && !isInternational && c.exchangeRateEnabled && (
                    <label>
                      <span className="campaign-field-label">Exchange Rate</span>
                      <input
                        type="number"
                        required
                        min="0.000001"
                        step="0.000001"
                        value={c.exchangeRate || ''}
                        onChange={(e) => update(idx, 'exchangeRate', Number(e.target.value))}
                        placeholder="e.g. 95"
                      />
                    </label>
                  )}
                  {isInternational && idx === 0 && (
                    <label>
                      <span className="campaign-field-label">Choose Currency</span>
                      <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {[...new Set([currency, ...currencyOptions])]
                          .sort((a, b) => a.localeCompare(b))
                          .map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="invoice-total-grid" aria-label="Invoice totals">
          <div>
            <span>Final amount</span>
            <strong>{money(t.base, displayCurrency)}</strong>
          </div>
          <div>
            <span>CGST</span>
            <strong>{money(t.cgst, displayCurrency)}</strong>
          </div>
          <div>
            <span>SGST</span>
            <strong>{money(t.sgst, displayCurrency)}</strong>
          </div>
          <div>
            <span>IGST</span>
            <strong>{money(t.igst, displayCurrency)}</strong>
          </div>
          <div className="grand-total">
            <span>Grand Total</span>
            <strong>{money(t.total, displayCurrency)}</strong>
          </div>
        </div>
        {isInternational && (
          <p className="currency-note">
            Invoice currency: {currency}. Enter rates in {currency}; no exchange-rate conversion is
            applied.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
            {saving ? 'Saving…' : invoice ? 'Save changes' : 'Create invoice'}
          </Button>
        </div>
      <PageGuide kind="invoice" /></form>
    </Dialog>
  );
}

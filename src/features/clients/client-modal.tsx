import { PageGuide } from '../../components/demo-guide';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { countries } from '../../countries';
import { normalizeGst, stateCodes, type Client } from '../../model';

export function ClientModal({
  client,
  editing,
  onEdit,
  onClose,
  onSave,
}: {
  client: Client;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSave: (c: Client) => void | Promise<void>;
}) {
  const [form, setForm] = useState<Client>({
    ...client,
    country: client.country || (client.id ? 'India' : ''),
  });
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const isIndia = form.country === 'India';
  function field(
    key: keyof Client,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      readOnly?: boolean;
      placeholder?: string;
      pattern?: string;
      maxLength?: number;
    } = {},
  ) {
    return (
      <label key={key}>
        {label}
        {editing ? (
          <input
            type={options.type || 'text'}
            value={form[key]}
            required={options.required}
            readOnly={options.readOnly}
            placeholder={options.placeholder}
            pattern={options.pattern}
            maxLength={options.maxLength}
            onChange={(e) => {
              const value = e.target.value;
              if (key === 'gst') {
                const gst = normalizeGst(value);
                setForm((prev) => ({
                  ...prev,
                  gst,
                  pan: prev.pan || 'DEMO-PAN',
                }));
                return;
              }
              setForm((prev) => ({ ...prev, [key]: value }));
            }}
          />
        ) : (
          <div className="detail-value">{form[key] || 'Not provided'}</div>
        )}
      </label>
    );
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    const gst = isIndia ? normalizeGst(form.gst.trim()) : '';
    setSaving(true);
    setSaveError('');
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        entityName: form.entityName.trim(),
        address: form.address.trim(),
        place: form.place.trim(),
        gst,
        pan: isIndia ? form.pan.trim() : '',
        state: isIndia ? form.state : '',
        stateCode: isIndia ? form.stateCode : '',
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the client.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      wide
      className="client-modal"
      title={!client.id ? 'Add a new client' : editing ? 'Edit client details' : 'Client details'}
      description="Keep the essentials together for faster invoicing."
      onClose={onClose}
    >
      <form onSubmit={save}>
        <div className={`client-primary-row ${isIndia ? 'india' : ''}`}>
          {field('name', 'Client name', {
            required: true,
            placeholder: 'Enter client name',
          })}
          {field('entityName', 'Entity name', {
            required: true,
            placeholder: 'Enter subsidiary or entity name',
          })}
          <label>
            Country
            {editing ? (
              <select
                required
                value={form.country}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                    state: '',
                    stateCode: '',
                    gst: '',
                    pan: '',
                    place: '',
                  }))
                }
              >
                <option value="">Select Country</option>
                {[...countries]
                  .sort((a, b) => a.localeCompare(b))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="detail-value">{form.country || 'Not provided'}</div>
            )}
          </label>
          {!isIndia &&
            form.country &&
            field('place', 'Place of supply', {
              required: true,
              placeholder: 'Enter place of supply',
            })}
        </div>
        {isIndia && (
          <>
            <div className="client-state-row">
              <label>
                State
                {editing ? (
                  <select
                    required
                    value={form.state}
                    onChange={(e) => {
                      const state = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        state,
                        stateCode: stateCodes[state] || '',
                        place: state ? `${stateCodes[state]}-${state}` : '',
                      }));
                    }}
                  >
                    <option value="">Select State</option>
                    {Object.keys(stateCodes)
                      .sort()
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div className="detail-value">{form.state || 'Not provided'}</div>
                )}
              </label>
              <label>
                State code
                {editing ? (
                  <input readOnly value={form.stateCode} placeholder="Filled from state" />
                ) : (
                  <div className="detail-value">{form.stateCode || 'Not provided'}</div>
                )}
              </label>
            </div>
            <div className="client-tax-row">
              {field('gst', 'GST number', {
                required: true,
                placeholder: '07-DEMO-CLIENT-1',
                maxLength: 40,
              })}
              {field('pan', 'Business PAN', {
                required: true,
                placeholder: 'DEMO-PAN-1',
                maxLength: 40,
              })}
              {field('place', 'Place of supply', {
                required: true,
                placeholder: 'Enter place of supply',
              })}
            </div>
          </>
        )}
        {form.country && (
          <>
            <div className="client-address-row">
              <label>
                Full address with PIN code
                {editing ? (
                  <textarea
                    required
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Street, city, postal code"
                  />
                ) : (
                  <div className="detail-value">{form.address || 'Not provided'}</div>
                )}
              </label>
            </div>
            <div className="client-poc-row">
              {field('poc', 'POC name', {
                required: true,
                placeholder: 'Contact name',
              })}
              {field('phone', 'POC phone number', {
                type: 'tel',
                placeholder: 'Contact phone',
              })}
              {field('email', 'POC email ID', {
                type: 'email',
                placeholder: 'Contact email',
              })}
            </div>
          </>
        )}
        {saveError && (
          <p role="alert" className="error">
            {saveError}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {editing ? (
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
              {saving ? 'Saving…' : 'Save client'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={(event) => {
                // The button becomes the submit button after editing is enabled. Preventing the
                // original click's default action keeps the browser from submitting the form
                // against that newly rendered button in the same interaction.
                event.preventDefault();
                onEdit();
              }}
            >
              Edit details
              <ArrowRight size={16} />
            </Button>
          )}
        </div>
      <PageGuide kind="clients" /></form>
    </Dialog>
  );
}

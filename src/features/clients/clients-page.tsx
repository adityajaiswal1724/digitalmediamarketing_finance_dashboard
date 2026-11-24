import { ArrowRight, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { type Client } from '../../model';

export function Clients({
  clients,
  onAdd,
  onView,
}: {
  clients: Client[];
  onAdd: () => void;
  onView: (c: Client) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = [...clients]
    .filter((c) => `${c.name} ${c.entityName || ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CLIENT DIRECTORY</div>
          <h1>
            Clients<span className="heading-dot">.</span>
          </h1>
          <p>Manage billing details and the people behind every partnership.</p>
        </div>
        <Button onClick={onAdd}>
          <Plus size={18} />
          Add client
        </Button>
      </div>
      <section className="panel clients-panel">
        <div className="history-heading">
          <div>
            <h2>
              Your clients <span className="count-badge">{clients.length}</span>
            </h2>
            <p>Select a client to view or update their details.</p>
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search clients"
              placeholder="Find a client…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="client-list">
          {filtered.map((c, idx) => (
            <div className="client-row" key={c.id}>
              <span className={`client-avatar color-${idx % 3}`}>
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {c.entityName && c.entityName !== c.name ? (
                    <>
                      {c.entityName} <span>·</span>{' '}
                    </>
                  ) : null}
                  {c.country === 'India' ? c.state : c.country} <span>·</span>{' '}
                  {c.country === 'India' ? c.gst : c.place}
                </p>
              </div>
              <button
                className="client-view"
                onClick={() => onView(c)}
                aria-label={`View ${c.name}`}
              >
                <span>View details</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
          {!filtered.length && (
            <div className="empty">
              <Users size={28} />
              <h3>No clients found</h3>
              <p>Add a client or try another search.</p>
            </div>
          )}
        </div>
        <div className="client-list-footer">
          <ShieldCheck size={15} />
          Client details are automatically used on your invoices.
        </div>
      </section>
    </motion.div>
  );
}

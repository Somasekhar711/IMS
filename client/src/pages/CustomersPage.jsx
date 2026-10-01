import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api';

const emptyCustomer = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  notes: '',
};

function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return undefined;
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage, errorMessage]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      setCustomers(await getCustomers());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleCustomers = customers.filter((entry) => (
    `${entry.name} ${entry.contactPerson} ${entry.email} ${entry.phone}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const updateField = (event) => {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setCustomer(emptyCustomer);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...customer, name: customer.name.trim() };

    try {
      const saved = editingId
        ? await updateCustomer(editingId, payload)
        : await createCustomer(payload);

      setCustomers((current) => editingId
        ? current.map((entry) => String(entry.id) === String(saved.id) ? saved : entry)
        : [...current, saved].sort((first, second) => first.name.localeCompare(second.name)));
      setStatusMessage(`${saved.name} ${editingId ? 'updated' : 'added'} successfully`);
      resetForm();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save customer');
    }
  };

  const beginEdit = (entry) => {
    setEditingId(entry.id);
    setCustomer({
      name: entry.name,
      contactPerson: entry.contactPerson || '',
      phone: entry.phone || '',
      email: entry.email || '',
      address: entry.address || '',
      taxId: entry.taxId || '',
      notes: entry.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete customer "${entry.name}"? This cannot be undone.`)) return;

    try {
      await deleteCustomer(entry.id);
      setCustomers((current) => current.filter((item) => String(item.id) !== String(entry.id)));
      if (String(editingId) === String(entry.id)) resetForm();
      setStatusMessage(`${entry.name} deleted successfully`);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete customer');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Customer directory</p>
          <h1>Customers</h1>
          <p>Keep track of who you sell to.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{customers.length} {customers.length === 1 ? 'customer' : 'customers'}</span>
        </div>
      </div>

      <section className="product-panel panel supplier-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Customer details</p>
            <h2>{editingId ? 'Update customer' : 'Add customer'}</h2>
          </div>
          {editingId ? <Pencil size={19} color="#63866f" /> : <Plus size={20} color="#63866f" />}
        </div>

        <form className="product-form supplier-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Customer name</span>
            <input name="name" value={customer.name} onChange={updateField} placeholder="Individual or business name" required maxLength={160} />
          </label>
          <label className="field">
            <span>Contact person</span>
            <input name="contactPerson" value={customer.contactPerson} onChange={updateField} placeholder="Contact name" maxLength={120} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" value={customer.phone} onChange={updateField} placeholder="Phone number" type="tel" maxLength={40} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" value={customer.email} onChange={updateField} placeholder="name@company.com" type="email" maxLength={255} />
          </label>
          <label className="field">
            <span>GSTIN / Tax ID</span>
            <input name="taxId" value={customer.taxId} onChange={updateField} placeholder="Optional tax ID" maxLength={40} />
          </label>
          <label className="field">
            <span>Address</span>
            <input name="address" value={customer.address} onChange={updateField} placeholder="Billing or shipping address" />
          </label>
          <label className="field supplier-notes-field">
            <span>Notes</span>
            <input name="notes" value={customer.notes} onChange={updateField} placeholder="Optional notes" />
          </label>

          <div className="supplier-form-actions">
            {editingId && (
              <button type="button" className="secondary-action" onClick={resetForm}>
                <X size={15} /> Cancel
              </button>
            )}
            <button className="submit-button product-submit" type="submit">
              {editingId ? <Pencil size={15} /> : <Plus size={15} />}
              {editingId ? 'Save customer' : 'Add customer'}
            </button>
          </div>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Customer list</h2>
          </div>
          <label className="product-search">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search customers" aria-label="Search customers" />
          </label>
        </div>

        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr><th>Customer</th><th>Contact</th><th>Phone / Email</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="4">Loading customers…</td></tr>
              ) : visibleCustomers.length ? visibleCustomers.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.name}</strong>{entry.taxId && <small className="supplier-tax-id">Tax ID: {entry.taxId}</small>}</td>
                  <td>{entry.contactPerson || '—'}</td>
                  <td><span>{entry.phone || '—'}</span>{entry.email && <small className="supplier-contact-email">{entry.email}</small>}</td>
                  <td className="table-actions supplier-table-actions">
                    <button className="icon-button" type="button" onClick={() => beginEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil size={15} /></button>
                    <button className="icon-button danger" type="button" onClick={() => handleDelete(entry)} aria-label={`Delete ${entry.name}`}><Trash2 size={15} /></button>
                  </td>
                </tr>
              )) : (
                <tr><td className="empty-products" colSpan="4">{searchTerm ? 'No customers match your search.' : 'No customers yet. Add your first customer above.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {statusMessage && <div className="success-toast" role="status"><Check size={16} /> {statusMessage}</div>}
      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

export { CustomersPage };

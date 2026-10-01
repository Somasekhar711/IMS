import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { createSupplier, deleteSupplier, getSuppliers, updateSupplier } from '../api';

const emptySupplier = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  notes: '',
  productIds: [],
};

function SuppliersPage({ products = [] }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState(emptySupplier);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return undefined;
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage, errorMessage]);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      setSuppliers(await getSuppliers());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleSuppliers = suppliers.filter((entry) => (
    `${entry.name} ${entry.contactPerson} ${entry.email} ${entry.phone}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const updateField = (event) => {
    const { name, value } = event.target;
    setSupplier((current) => ({ ...current, [name]: value }));
  };

  const toggleProduct = (productId) => {
    const id = String(productId);
    setSupplier((current) => ({
      ...current,
      productIds: current.productIds.includes(id)
        ? current.productIds.filter((selectedId) => selectedId !== id)
        : [...current.productIds, id],
    }));
  };

  const resetForm = () => {
    setSupplier(emptySupplier);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...supplier, name: supplier.name.trim(), productIds: supplier.productIds };

    try {
      const saved = editingId
        ? await updateSupplier(editingId, payload)
        : await createSupplier(payload);
      const associatedProducts = products.filter((product) => payload.productIds.includes(String(product.id)));
      const savedSupplier = { ...saved, products: associatedProducts };

      setSuppliers((current) => editingId
        ? current.map((entry) => String(entry.id) === String(saved.id) ? savedSupplier : entry)
        : [...current, savedSupplier].sort((first, second) => first.name.localeCompare(second.name)));
      setStatusMessage(`${saved.name} ${editingId ? 'updated' : 'added'} successfully`);
      resetForm();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save supplier');
    }
  };

  const beginEdit = (entry) => {
    setEditingId(entry.id);
    setSupplier({
      name: entry.name,
      contactPerson: entry.contactPerson || '',
      phone: entry.phone || '',
      email: entry.email || '',
      address: entry.address || '',
      taxId: entry.taxId || '',
      notes: entry.notes || '',
      productIds: (entry.products || []).map((product) => String(product.id)),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (entry) => {
    if (entry.products?.length) {
      setErrorMessage(`${entry.name} is linked to ${entry.products.length} product${entry.products.length === 1 ? '' : 's'}. Edit the supplier and remove those associations before deleting it.`);
      return;
    }

    if (!window.confirm(`Delete supplier "${entry.name}"? This cannot be undone.`)) return;

    try {
      await deleteSupplier(entry.id);
      setSuppliers((current) => current.filter((item) => String(item.id) !== String(entry.id)));
      if (String(editingId) === String(entry.id)) resetForm();
      setStatusMessage(`${entry.name} deleted successfully`);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete supplier');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Supplier directory</p>
          <h1>Suppliers</h1>
          <p>Keep supplier contacts and the products they provide together.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{suppliers.length} {suppliers.length === 1 ? 'supplier' : 'suppliers'}</span>
        </div>
      </div>

      <section className="product-panel panel supplier-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Supplier details</p>
            <h2>{editingId ? 'Update supplier' : 'Add supplier'}</h2>
          </div>
          {editingId ? <Pencil size={19} color="#63866f" /> : <Plus size={20} color="#63866f" />}
        </div>

        <form className="product-form supplier-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Supplier name</span>
            <input name="name" value={supplier.name} onChange={updateField} placeholder="Company or supplier name" required maxLength={160} />
          </label>
          <label className="field">
            <span>Contact person</span>
            <input name="contactPerson" value={supplier.contactPerson} onChange={updateField} placeholder="Contact name" maxLength={120} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" value={supplier.phone} onChange={updateField} placeholder="Phone number" type="tel" maxLength={40} />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="email" value={supplier.email} onChange={updateField} placeholder="name@company.com" type="email" maxLength={255} />
          </label>
          <label className="field">
            <span>GSTIN / Tax ID</span>
            <input name="taxId" value={supplier.taxId} onChange={updateField} placeholder="Optional tax ID" maxLength={40} />
          </label>
          <label className="field">
            <span>Address</span>
            <input name="address" value={supplier.address} onChange={updateField} placeholder="Business address" />
          </label>
          <label className="field supplier-notes-field">
            <span>Notes</span>
            <input name="notes" value={supplier.notes} onChange={updateField} placeholder="Optional notes" />
          </label>

          <fieldset className="supplier-product-picker">
            <legend>Products supplied</legend>
            {products.length ? (
              <div className="supplier-product-options">
                {products.map((product) => (
                  <label key={product.id} className="supplier-product-option">
                    <input
                      type="checkbox"
                      checked={supplier.productIds.includes(String(product.id))}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <span><strong>{product.itemName}</strong><small>HSN {product.hsn}</small></span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="supplier-no-products">Add products first to associate them with a supplier.</p>
            )}
          </fieldset>

          <div className="supplier-form-actions">
            {editingId && (
              <button type="button" className="secondary-action" onClick={resetForm}>
                <X size={15} /> Cancel
              </button>
            )}
            <button className="submit-button product-submit" type="submit">
              {editingId ? <Pencil size={15} /> : <Plus size={15} />}
              {editingId ? 'Save supplier' : 'Add supplier'}
            </button>
          </div>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Supplier list</h2>
          </div>
          <label className="product-search">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search suppliers" aria-label="Search suppliers" />
          </label>
        </div>

        <div className="product-table-wrap">
          <table className="product-table supplier-table">
            <thead>
              <tr><th>Supplier</th><th>Contact</th><th>Phone / Email</th><th>Products</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="5">Loading suppliers…</td></tr>
              ) : visibleSuppliers.length ? visibleSuppliers.map((entry) => {
                const expanded = String(expandedSupplierId) === String(entry.id);
                return (
                  <SupplierRows
                    key={entry.id}
                    supplier={entry}
                    expanded={expanded}
                    onToggle={() => setExpandedSupplierId(expanded ? null : entry.id)}
                    onEdit={() => beginEdit(entry)}
                    onDelete={() => handleDelete(entry)}
                  />
                );
              }) : (
                <tr><td className="empty-products" colSpan="5">{searchTerm ? 'No suppliers match your search.' : 'No suppliers yet. Add your first supplier above.'}</td></tr>
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

function SupplierRows({ supplier, expanded, onToggle, onEdit, onDelete }) {
  return (
    <>
      <tr>
        <td><strong>{supplier.name}</strong>{supplier.taxId && <small className="supplier-tax-id">Tax ID: {supplier.taxId}</small>}</td>
        <td>{supplier.contactPerson || '—'}</td>
        <td><span>{supplier.phone || '—'}</span>{supplier.email && <small className="supplier-contact-email">{supplier.email}</small>}</td>
        <td>{supplier.products?.length || 0}</td>
        <td className="table-actions supplier-table-actions">
          <button className="secondary-action" type="button" onClick={onToggle}>{expanded ? 'Hide products' : 'View products'}</button>
          <button className="icon-button" type="button" onClick={onEdit} aria-label={`Edit ${supplier.name}`}><Pencil size={15} /></button>
          <button className="icon-button danger" type="button" onClick={onDelete} aria-label={`Delete ${supplier.name}`}><Trash2 size={15} /></button>
        </td>
      </tr>
      {expanded && (
        <tr className="supplier-detail-row">
          <td colSpan="5">
            <div className="supplier-detail-content">
              <div><strong>Products supplied</strong>{supplier.address && <span>{supplier.address}</span>}</div>
              {supplier.products?.length ? (
                <div className="supplier-product-pills">
                  {supplier.products.map((product) => <span key={product.id}>{product.itemName}<small>HSN {product.hsn}</small></span>)}
                </div>
              ) : (
                <span className="supplier-no-products">No products associated with this supplier.</span>
              )}
              {supplier.notes && <p>{supplier.notes}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export { SuppliersPage };

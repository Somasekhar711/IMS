import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { productFields } from './productFields';

function ProductsListPage({ products, onUpdateProduct, onDeleteProduct, onAddProduct }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [lookupTerm, setLookupTerm] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [successNotification, setSuccessNotification] = useState('');

  useEffect(() => {
    if (!successNotification) return undefined;
    const timeoutId = setTimeout(() => setSuccessNotification(''), 3500);
    return () => clearTimeout(timeoutId);
  }, [successNotification]);

  const visibleProducts = products.filter((item) => `${item.itemName} ${item.hsn} ${item.itemCategory}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const updateField = (event) => setEditingProduct((current) => ({ ...current, [event.target.name]: event.target.value }));
  const saveProduct = (event) => {
    event.preventDefault();
    onUpdateProduct(editingProduct);
    setSuccessNotification(`${editingProduct.itemName} updated Successfully`);
    setEditingProduct(null);
    setIsUpdateOpen(false);
    setLookupTerm('');
    setLookupMessage('');
  };

  const openUpdate = (product = null) => {
    setIsUpdateOpen(true);
    setEditingProduct(product);
    setLookupTerm(product ? product.hsn : '');
    setLookupMessage(product ? `Existing details loaded for ${product.itemName}.` : '');
  };

  const closeUpdate = () => {
    setIsUpdateOpen(false);
    setEditingProduct(null);
    setLookupTerm('');
    setLookupMessage('');
  };

  const findProduct = (event) => {
    event.preventDefault();
    const normalizedLookup = lookupTerm.trim().toLowerCase();
    const match = products.find((item) => item.hsn.toLowerCase() === normalizedLookup || item.itemName.toLowerCase() === normalizedLookup);
    setEditingProduct(match || null);
    setLookupMessage(match ? `Existing details loaded for ${match.itemName}.` : 'No product found. Check the HSN or item name and try again.');
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Catalog management</p><h1>Products</h1><p>Search, update, and manage every item in your catalog.</p></div><div className="product-intro-actions"><span className="product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span><button className="secondary-action" onClick={openUpdate}><Pencil size={15} /> Update product</button><button className="submit-button product-add-button" onClick={onAddProduct}><Plus size={15} /> Add product</button></div></div>
      <section className="product-list-section"><div className="product-list-heading"><div><p className="eyebrow">Current catalog</p><h2>View products</h2></div><label className="product-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>HSN</th><th>Item name</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Expiry</th><th aria-label="Actions" /></tr></thead><tbody>{visibleProducts.length ? visibleProducts.map((item) => <tr key={item.id}><td>{item.hsn}</td><td><strong>{item.itemName}</strong></td><td>{item.itemCategory || '—'}</td><td>₹{item.itemPrice || '0.00'}</td><td>{item.gst || '0'}%</td><td><span className={Number(item.stockPresent) <= Number(item.thresholdStock) ? 'stock-low' : ''}>{item.stockPresent || '0'}</span></td><td>{item.expiryDate || '—'}</td><td className="table-actions"><button className="icon-button" onClick={() => openUpdate(item)} aria-label={`Edit ${item.itemName}`}><Pencil size={15} /></button><button className="icon-button danger" onClick={() => onDeleteProduct(item.id)} aria-label={`Delete ${item.itemName}`}><Trash2 size={15} /></button></td></tr>) : <tr><td className="empty-products" colSpan="8">No products yet. Add your first inventory item.</td></tr>}</tbody></table></div></section>
      {isUpdateOpen && <div className="modal-backdrop" onMouseDown={closeUpdate}><section className="edit-modal panel" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">Catalog management</p><h2>Update product</h2></div><button className="icon-button" onClick={closeUpdate} aria-label="Close update form"><X size={17} /></button></div><form className="product-lookup" onSubmit={findProduct}><label className="field"><span>Find by HSN or item name</span><div className="lookup-input"><Search size={16} /><input value={lookupTerm} onChange={(event) => setLookupTerm(event.target.value)} placeholder="Enter HSN or item name" aria-label="Find product by HSN or item name" required /></div></label><button className="lookup-button" type="submit">Find product</button></form>{lookupMessage && <p className={`update-message ${editingProduct ? 'is-success' : 'is-error'}`}>{editingProduct ? <Check size={14} /> : <X size={14} />} {lookupMessage}</p>}{editingProduct && <form className="product-form" onSubmit={saveProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}{key === 'hsn' || key === 'itemName' ? ' (cannot be changed)' : ''}</span><input name={key} value={editingProduct[key] || ''} onChange={updateField} placeholder={placeholder} type={type} readOnly={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Pencil size={15} /> Save changes</button></form>}</section></div>}{successNotification && <div className="success-toast" role="status"><Check size={16} /> {successNotification}</div>}
    </div>
  );
}

export { ProductsListPage };

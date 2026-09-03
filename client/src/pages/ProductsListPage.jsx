import { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { productFields } from './productFields';

function ProductsListPage({ products, onUpdateProduct, onDeleteProduct, onAddProduct }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);

  const visibleProducts = products.filter((item) => `${item.itemName} ${item.hsn} ${item.itemCategory}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const updateField = (event) => setEditingProduct((current) => ({ ...current, [event.target.name]: event.target.value }));
  const saveProduct = (event) => {
    event.preventDefault();
    onUpdateProduct(editingProduct);
    setEditingProduct(null);
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Catalog management</p><h1>Products</h1><p>Search, update, and manage every item in your catalog.</p></div><div className="product-intro-actions"><span className="product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span><button className="submit-button product-add-button" onClick={onAddProduct}><Plus size={15} /> Add product</button></div></div>
      <section className="product-list-section"><div className="product-list-heading"><div><p className="eyebrow">Current catalog</p><h2>View products</h2></div><label className="product-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>HSN</th><th>Item name</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Expiry</th><th aria-label="Actions" /></tr></thead><tbody>{visibleProducts.length ? visibleProducts.map((item) => <tr key={item.id}><td>{item.hsn}</td><td><strong>{item.itemName}</strong></td><td>{item.itemCategory || '—'}</td><td>₹{item.itemPrice || '0.00'}</td><td>{item.gst || '0'}%</td><td><span className={Number(item.stockPresent) <= Number(item.thresholdStock) ? 'stock-low' : ''}>{item.stockPresent || '0'}</span></td><td>{item.expiryDate || '—'}</td><td className="table-actions"><button className="icon-button" onClick={() => setEditingProduct(item)} aria-label={`Edit ${item.itemName}`}><Pencil size={15} /></button><button className="icon-button danger" onClick={() => onDeleteProduct(item.id)} aria-label={`Delete ${item.itemName}`}><Trash2 size={15} /></button></td></tr>) : <tr><td className="empty-products" colSpan="8">No products yet. Add your first inventory item.</td></tr>}</tbody></table></div></section>
      {editingProduct && <div className="modal-backdrop" onMouseDown={() => setEditingProduct(null)}><section className="edit-modal panel" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">Catalog management</p><h2>Edit product</h2></div><button className="icon-button" onClick={() => setEditingProduct(null)} aria-label="Close edit form">×</button></div><form className="product-form" onSubmit={saveProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span><input name={key} value={editingProduct[key] || ''} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Pencil size={15} /> Save changes</button></form></section></div>}
    </div>
  );
}

export { ProductsListPage };

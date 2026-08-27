import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';

const emptyProduct = {
  hsn: '',
  itemName: '',
  itemPrice: '',
  itemCategory: '',
  gst: '',
  discount: '',
  mfd: '',
  expiryDate: '',
  stockUpdatedDate: '',
  stockPresent: '',
  thresholdStock: '',
};

const fields = [
  { key: 'hsn', label: 'HSN', placeholder: 'e.g. 1905', type: 'text' },
  { key: 'itemName', label: 'Item name', placeholder: 'Product name', type: 'text' },
  { key: 'itemPrice', label: 'Item price', placeholder: '0.00', type: 'number' },
  { key: 'itemCategory', label: 'Item category', placeholder: 'e.g. Grocery', type: 'text' },
  { key: 'gst', label: 'GST%', placeholder: '0', type: 'number' },
  { key: 'discount', label: 'Discount%', placeholder: '0', type: 'number' },
  { key: 'mfd', label: 'MFD', type: 'date' },
  { key: 'expiryDate', label: 'Expiry date', type: 'date' },
  { key: 'stockUpdatedDate', label: 'Stock updated date', type: 'date' },
  { key: 'stockPresent', label: 'Stock present now', placeholder: '0', type: 'number' },
  { key: 'thresholdStock', label: 'Threshold stock', placeholder: '0', type: 'number' },
];

function ProductPage() {
  const [product, setProduct] = useState(emptyProduct);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const updateField = (event) => {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!product.itemName.trim() || !product.hsn.trim()) return;
    setProducts((current) => [{ ...product, id: crypto.randomUUID() }, ...current]);
    setProduct(emptyProduct);
  };

  const deleteProduct = (id) => {
    setProducts((current) => current.filter((item) => item.id !== id));
  };

  const visibleProducts = products.filter((item) =>
    `${item.itemName} ${item.hsn} ${item.itemCategory}`.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>Products</h1>
          <p>Add products, keep their stock details current, and find them quickly.</p>
        </div>
        <span className="product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span>
      </div>

      <section className="product-panel panel">
        <div className="panel-heading"><div><p className="eyebrow">New inventory item</p><h2>Add product</h2></div><Plus size={20} color="#63866f" /></div>
        <form className="product-form" onSubmit={addProduct}>
          {fields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span><input name={key} value={product[key]} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}
          <button className="submit-button product-submit" type="submit"><Plus size={16} /> Add product</button>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading"><div><p className="eyebrow">Current catalog</p><h2>View products</h2></div><label className="product-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div>
        <div className="product-table-wrap">
          <table className="product-table"><thead><tr><th>HSN</th><th>Item name</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Expiry</th><th aria-label="Actions" /></tr></thead><tbody>
            {visibleProducts.length ? visibleProducts.map((item) => <tr key={item.id}><td>{item.hsn}</td><td><strong>{item.itemName}</strong></td><td>{item.itemCategory || '—'}</td><td>₹{item.itemPrice || '0.00'}</td><td>{item.gst || '0'}%</td><td><span className={Number(item.stockPresent) <= Number(item.thresholdStock) ? 'stock-low' : ''}>{item.stockPresent || '0'}</span></td><td>{item.expiryDate || '—'}</td><td><button className="icon-button danger" onClick={() => deleteProduct(item.id)} aria-label={`Delete ${item.itemName}`}><Trash2 size={15} /></button></td></tr>) : <tr><td className="empty-products" colSpan="8">No products yet. Add your first inventory item above.</td></tr>}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

export { ProductPage };
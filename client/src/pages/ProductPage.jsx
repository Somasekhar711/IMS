import { useState, useEffect } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { getProducts, createProduct, deleteProduct } from '../api';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadProducts(searchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  async function loadProducts(search) {
    setIsLoading(true);
    setError('');
    try {
      const data = await getProducts(search);
      setProducts(data);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }

  const updateField = (event) => {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
  };

  const addProduct = async (event) => {
    event.preventDefault();
    if (!product.itemName.trim() || !product.hsn.trim()) return;

    setIsSaving(true);
    setError('');
    try {
      const created = await createProduct({
        hsn: product.hsn,
        itemName: product.itemName,
        itemPrice: product.itemPrice,
        itemCategory: product.itemCategory,
        gst: product.gst,
        discount: product.discount,
        mfd: product.mfd,
        expiryDate: product.expiryDate,
        stockUpdatedDate: product.stockUpdatedDate,
        stockPresent: product.stockPresent,
        thresholdStock: product.thresholdStock,
      });
      setProducts((current) => [created, ...current]);
      setProduct(emptyProduct);
    } catch (err) {
      setError(err.message || 'Failed to add product');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProductItem = async (id) => {
    try {
      await deleteProduct(id);
      setProducts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete product');
    }
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

      {error && <div className="auth-error">{error}</div>}

      <section className="product-panel panel">
        <div className="panel-heading"><div><p className="eyebrow">New inventory item</p><h2>Add product</h2></div><Plus size={20} color="#63866f" /></div>
        <form className="product-form" onSubmit={addProduct}>
          {fields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span><input name={key} value={product[key]} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}
          <button className="submit-button product-submit" type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Add product'} <Plus size={16} /></button>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading"><div><p className="eyebrow">Current catalog</p><h2>View products</h2></div><label className="product-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products" aria-label="Search products" /></label></div>
        <div className="product-table-wrap">
          <table className="product-table"><thead><tr><th>HSN</th><th>Item name</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Expiry</th><th aria-label="Actions" /></tr></thead><tbody>
            {isLoading ? <tr><td className="empty-products" colSpan="8">Loading products...</td></tr> : visibleProducts.length ? visibleProducts.map((item) => <tr key={item.id}><td>{item.hsn}</td><td><strong>{item.itemName}</strong></td><td>{item.itemCategory || '—'}</td><td>₹{item.itemPrice || '0.00'}</td><td>{item.gst || '0'}%</td><td><span className={Number(item.stockPresent) <= Number(item.thresholdStock) ? 'stock-low' : ''}>{item.stockPresent || '0'}</span></td><td>{item.expiryDate || '—'}</td><td><button className="icon-button danger" onClick={() => deleteProductItem(item.id)} aria-label={`Delete ${item.itemName}`}><Trash2 size={15} /></button></td></tr>) : <tr><td className="empty-products" colSpan="8">No products yet. Add your first inventory item above.</td></tr>}
          </tbody></table>
        </div>
      </section>
    </div>
  );
}

export { ProductPage };

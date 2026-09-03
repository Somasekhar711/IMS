import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, Search, X } from 'lucide-react';
import { emptyProduct, productFields } from './productFields';

function AddProductPage({ products, onAddProduct, onUpdateProduct, onBack }) {
  const [product, setProduct] = useState(emptyProduct);
  const [lookupTerm, setLookupTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [successNotification, setSuccessNotification] = useState('');

  useEffect(() => {
    if (!successNotification) return undefined;
    const timeoutId = setTimeout(() => setSuccessNotification(''), 3500);
    return () => clearTimeout(timeoutId);
  }, [successNotification]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
    setEditingProduct((current) => current ? { ...current, [name]: value } : current);
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!product.itemName.trim() || !product.hsn.trim()) return;
    onAddProduct(product);
    setProduct(emptyProduct);
  };

  const findProduct = (event) => {
    event.preventDefault();
    const normalizedLookup = lookupTerm.trim().toLowerCase();
    const match = products.find((item) => item.hsn.toLowerCase() === normalizedLookup || item.itemName.toLowerCase() === normalizedLookup);
    setEditingProduct(match || null);
    setLookupMessage(match ? `Existing details loaded for ${match.itemName}.` : 'No product found. Check the HSN or item name and try again.');
  };

  const updateProduct = (event) => {
    event.preventDefault();
    onUpdateProduct(editingProduct);
    setLookupMessage(`${editingProduct.itemName} updated successfully.`);
    setSuccessNotification(`${editingProduct.itemName} updated Successfully`);
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Catalog management</p><h1>Add product</h1><p>Create a new inventory item and set its stock controls.</p></div><button className="back-button" onClick={onBack}><ArrowLeft size={15} /> View products</button></div>
      <section className="product-panel panel"><div className="panel-heading"><div><p className="eyebrow">New inventory item</p><h2>Product details</h2></div><Plus size={20} color="#63866f" /></div><form className="product-form" onSubmit={addProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span><input name={key} value={product[key]} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Plus size={16} /> Add product</button></form></section>
      <section className="product-panel panel update-product-panel"><div className="panel-heading"><div><p className="eyebrow">Existing inventory item</p><h2>Update product</h2></div><Pencil size={19} color="#63866f" /></div><form className="product-lookup" onSubmit={findProduct}><label className="field"><span>Find by HSN or item name</span><div className="lookup-input"><Search size={16} /><input value={lookupTerm} onChange={(event) => setLookupTerm(event.target.value)} placeholder="Enter HSN or item name" aria-label="Find product by HSN or item name" required /></div></label><button className="lookup-button" type="submit">Find product</button></form>{lookupMessage && <p className={`update-message ${editingProduct ? 'is-success' : 'is-error'}`}>{editingProduct ? <Check size={14} /> : <X size={14} />} {lookupMessage}</p>}{editingProduct && <form className="product-form" onSubmit={updateProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}{key === 'hsn' || key === 'itemName' ? ' (cannot be changed)' : ''}</span><input name={key} value={editingProduct[key] || ''} onChange={updateField} placeholder={placeholder} type={type} readOnly={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Check size={15} /> Save changes</button></form>}</section>{successNotification && <div className="success-toast" role="status"><Check size={16} /> {successNotification}</div>}
    </div>
  );
}

export { AddProductPage };

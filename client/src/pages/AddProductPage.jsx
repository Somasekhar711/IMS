import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { emptyProduct, productFields } from './productFields';

function AddProductPage({ onAddProduct, onBack }) {
  const [product, setProduct] = useState(emptyProduct);

  const updateField = (event) => {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!product.itemName.trim() || !product.hsn.trim()) return;
    onAddProduct(product);
    setProduct(emptyProduct);
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Catalog management</p><h1>Add product</h1><p>Create a new inventory item and set its stock controls.</p></div><button className="back-button" onClick={onBack}><ArrowLeft size={15} /> View products</button></div>
      <section className="product-panel panel"><div className="panel-heading"><div><p className="eyebrow">New inventory item</p><h2>Product details</h2></div><Plus size={20} color="#63866f" /></div><form className="product-form" onSubmit={addProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}</span><input name={key} value={product[key]} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Plus size={16} /> Add product</button></form></section>
    </div>
  );
}

export { AddProductPage };

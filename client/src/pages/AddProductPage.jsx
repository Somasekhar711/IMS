import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Pencil, Plus, ScanBarcode, Search, X } from 'lucide-react';
import { BarcodeScanner } from '../BarcodeScanner';
import { getCategories } from '../api';
import { emptyProduct, productFields } from './productFields';

function AddProductPage({ products, onAddProduct, onUpdateProduct, onBack }) {
  const [product, setProduct] = useState(emptyProduct);
  const [lookupTerm, setLookupTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [updateStatus, setUpdateStatus] = useState({ text: '', isError: false });
  const [successNotification, setSuccessNotification] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState({ text: '', isError: false });
  const autoFilledName = useRef('');

  // A scanned barcode either opens the existing product for updating, or starts a
  // new product with the barcode filled in (and the name, if Open Food Facts knows it).
  const handleScan = useCallback(async (code) => {
    setIsScannerOpen(false);
    const existing = products.find((item) => item.barcode && item.barcode === code);
    if (existing) {
      setEditingProduct(existing);
      setLookupTerm(existing.hsn);
      setLookupMessage(`Existing details loaded for ${existing.itemName}.`);
      setScanMessage({ text: `Barcode ${code} is already "${existing.itemName}". It is open below to update.`, isError: false });
      return;
    }
    // A new scan replaces a name the previous scan filled in, but never one the user typed.
    // (Read the ref now: React runs the updater later, after the ref is reset below.)
    const previousAutoName = autoFilledName.current;
    autoFilledName.current = '';
    setProduct((current) => ({
      ...current,
      barcode: code,
      itemName: previousAutoName && current.itemName === previousAutoName ? '' : current.itemName,
    }));
    setScanMessage({ text: `Scanned ${code}. Looking up the product name…`, isError: false });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`, { signal: controller.signal });
      clearTimeout(timer);
      const data = await response.json();
      const found = data?.status === 1 ? data.product : null;
      // "400 g e": the trailing e / ℮ is the EU "estimated quantity" mark, not part of the name.
      const quantity = (found?.quantity || '').replace(/\s*[e℮]\s*$/i, '').trim();
      const title = found?.product_name?.trim() || '';
      // Brands can list the company first ("COCA-COLA SERVICES SA/NV, Coca-Cola"); skip
      // the brand if any listed brand already appears in the product name.
      // Company names ("COCA-COLA SERVICES SA/NV", "Hindustan Unilever Ltd") are not brands shoppers know.
      const looksLikeCompany = (brand) => /\/|\b(s\.?a|n\.?v|ltd|limited|inc|gmbh|llc|pvt|plc|corp|services|company)\b/i.test(brand);
      const brands = (found?.brands || '').split(',').map((brand) => brand.trim()).filter((brand) => brand && !looksLikeCompany(brand));
      const brandInTitle = brands.some((brand) => title.toLowerCase().includes(brand.toLowerCase()));
      const name = found ? [brandInTitle ? '' : brands[0], title, quantity].filter(Boolean).join(' ') : '';
      if (name) {
        setProduct((current) => {
          if (current.itemName) return current;
          autoFilledName.current = name;
          return { ...current, itemName: name };
        });
        setScanMessage({ text: `Scanned ${code}: found "${name}". Check the details and fill in the rest.`, isError: false });
      } else {
        setScanMessage({ text: `Scanned ${code}. Not found in the product database; enter the details.`, isError: false });
      }
    } catch {
      setScanMessage({ text: `Scanned ${code}. Enter the product details.`, isError: false });
    }
  }, [products]);

  useEffect(() => {
    if (!successNotification) return undefined;
    const timeoutId = setTimeout(() => setSuccessNotification(''), 3500);
    return () => clearTimeout(timeoutId);
  }, [successNotification]);

  useEffect(() => {
    getCategories().then((categories) => setCategorySuggestions(categories)).catch(() => setCategorySuggestions([]));
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setProduct((current) => ({ ...current, [name]: value }));
    setEditingProduct((current) => current ? { ...current, [name]: value } : current);
  };

  const matchingCategories = (product.itemCategory || '').trim()
    ? categorySuggestions.filter((category) => category.name.toLowerCase().includes(product.itemCategory.trim().toLowerCase())).slice(0, 6)
    : [];

  const addProduct = async (event) => {
    event.preventDefault();
    if (!product.itemName.trim() || !product.hsn.trim() || product.itemPrice === '') return;
    setAddError('');
    try {
      await onAddProduct(product);
      setProduct(emptyProduct);
      setScanMessage({ text: '', isError: false });
      autoFilledName.current = '';
    } catch (error) {
      setAddError(error.message || 'Unable to add product');
    }
  };

  const findProduct = (event) => {
    event.preventDefault();
    const normalizedLookup = lookupTerm.trim().toLowerCase();
    const match = products.find((item) => item.hsn.toLowerCase() === normalizedLookup || item.itemName.toLowerCase() === normalizedLookup);
    setEditingProduct(match || null);
    setUpdateStatus({ text: '', isError: false });
    setLookupMessage(match ? `Existing details loaded for ${match.itemName}.` : 'No product found. Check the HSN or item name and try again.');
  };

  const updateProduct = async (event) => {
    event.preventDefault();
    try {
      await onUpdateProduct(editingProduct);
      setUpdateStatus({ text: `${editingProduct.itemName} updated successfully.`, isError: false });
      setSuccessNotification(`${editingProduct.itemName} updated Successfully`);
    } catch (error) {
      setUpdateStatus({ text: error.message || `Unable to update ${editingProduct.itemName}`, isError: true });
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Catalog management</p><h1>Add product</h1><p>Create a new inventory item and set its stock controls.</p></div><button className="back-button" onClick={onBack}><ArrowLeft size={15} /> View products</button></div>
      <section className="product-panel panel"><div className="panel-heading"><div><p className="eyebrow">New inventory item</p><h2>Product details</h2></div><button type="button" className="secondary-action scan-button" onClick={() => setIsScannerOpen(true)}><ScanBarcode size={16} /> Scan barcode</button></div>{scanMessage.text && <p className={`update-message ${scanMessage.isError ? 'is-error' : 'is-success'}`}><Check size={14} /> {scanMessage.text}</p>}<form className="product-form" onSubmit={addProduct}>{productFields.map(({ key, label, placeholder, type }) => key === 'itemCategory' ? <label className="field category-field" key={key}><span>{label}</span><div className="category-input-wrap"><input name={key} value={product[key]} onChange={(event) => { updateField(event); setShowCategorySuggestions(true); }} onFocus={() => setShowCategorySuggestions(true)} onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 120)} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} autoComplete="off" /></div>{showCategorySuggestions && matchingCategories.length > 0 && <ul className="category-suggestions" role="listbox">{matchingCategories.map((category) => <li key={category.id}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setProduct((current) => ({ ...current, itemCategory: category.name })); setShowCategorySuggestions(false); }}>{category.name}</button></li>)}</ul>}</label> : <label className="field" key={key}><span>{label}</span><input name={key} value={product[key]} onChange={updateField} placeholder={placeholder} type={type} required={key === 'hsn' || key === 'itemName' || key === 'itemPrice'} min={type === 'number' ? 0 : undefined} step={key === 'itemPrice' || key === 'costPrice' ? '0.01' : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Plus size={16} /> Add product</button></form>{addError && <p className="update-message is-error"><X size={14} /> {addError}</p>}</section>
      <section className="product-panel panel update-product-panel"><div className="panel-heading"><div><p className="eyebrow">Existing inventory item</p><h2>Update product</h2></div><Pencil size={19} color="#63866f" /></div><form className="product-lookup" onSubmit={findProduct}><label className="field"><span>Find by HSN or item name</span><div className="lookup-input"><Search size={16} /><input value={lookupTerm} onChange={(event) => setLookupTerm(event.target.value)} placeholder="Enter HSN or item name" aria-label="Find product by HSN or item name" required /></div></label><button className="lookup-button" type="submit">Find product</button></form>{lookupMessage && <p className={`update-message ${editingProduct ? 'is-success' : 'is-error'}`}>{editingProduct ? <Check size={14} /> : <X size={14} />} {lookupMessage}</p>}{editingProduct && <form className="product-form" onSubmit={updateProduct}>{productFields.map(({ key, label, placeholder, type }) => <label className="field" key={key}><span>{label}{key === 'hsn' || key === 'itemName' ? ' (cannot be changed)' : ''}</span><input name={key} value={editingProduct[key] || ''} onChange={updateField} placeholder={placeholder} type={type} readOnly={key === 'hsn' || key === 'itemName'} min={type === 'number' ? 0 : undefined} /></label>)}<button className="submit-button product-submit" type="submit"><Check size={15} /> Save changes</button></form>}{updateStatus.text && <p className={`update-message ${updateStatus.isError ? 'is-error' : 'is-success'}`}>{updateStatus.isError ? <X size={14} /> : <Check size={14} />} {updateStatus.text}</p>}</section>{successNotification && <div className="success-toast" role="status"><Check size={16} /> {successNotification}</div>}{isScannerOpen && <BarcodeScanner onDetected={handleScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
}

export { AddProductPage };

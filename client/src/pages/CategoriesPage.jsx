import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api';

function CategoriesPage({ products = [], onCategoryChange }) {
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return undefined;
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage, errorMessage]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load categories');
    }
  };

  const filteredCategories = categories.filter((category) => {
    const term = `${category.name} ${category.description || ''}`.toLowerCase();
    return term.includes(searchTerm.toLowerCase());
  });

  const productsByCategory = categories.reduce((result, category) => {
    const matchingProducts = products.filter((product) => {
      const currentCategory = (product.itemCategory || '').trim().toLowerCase();
      return currentCategory === category.name.trim().toLowerCase();
    });

    result[category.id] = matchingProducts;
    return result;
  }, {});

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage('Category name is required');
      return;
    }

    try {
      if (editingId) {
        const updated = await updateCategory(editingId, trimmedName, description.trim());
        setCategories((current) => current.map((category) => (category.id === updated.id ? updated : category)));
        setStatusMessage(`${updated.name} updated successfully`);
      } else {
        const created = await createCategory(trimmedName, description.trim());
        setCategories((current) => [created, ...current]);
        setStatusMessage(`${created.name} created successfully`);
      }

      if (onCategoryChange) {
        await onCategoryChange();
      }
      resetForm();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save category');
    }
  };

  const handleEdit = (category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description || '');
  };

  const handleDelete = async (id) => {
    const category = categories.find((entry) => entry.id === id);
    if (!category) return;

    const categoryProducts = productsByCategory[id] || [];
    if (categoryProducts.length > 0) {
      setErrorMessage(`This category is used by ${categoryProducts.length} product${categoryProducts.length > 1 ? 's' : ''}. Move or remove them before deleting it.`);
      return;
    }

    const confirmed = window.confirm(`Delete "${category.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteCategory(id);
      setCategories((current) => current.filter((categoryItem) => categoryItem.id !== id));
      if (onCategoryChange) {
        await onCategoryChange();
      }
      if (editingId === id) {
        resetForm();
      }
      setStatusMessage('Category deleted successfully');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete category');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Catalog structure</p>
          <h1>Categories</h1>
          <p>Organize your products into clear, reusable groups.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
        </div>
      </div>

      <section className="product-panel panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Taxonomy</p>
            <h2>{editingId ? 'Edit category' : 'Create category'}</h2>
          </div>
          <Plus size={20} color="#63866f" />
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Category name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter category name"
              required
            />
          </label>

          <label className="field">
            <span>Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />
          </label>

          <div className="product-intro-actions" style={{ gridColumn: '1 / -1' }}>
            {editingId && (
              <button type="button" className="secondary-action" onClick={resetForm}>
                <X size={15} /> Cancel
              </button>
            )}
            <button className="submit-button product-submit" type="submit">
              {editingId ? <Pencil size={15} /> : <Plus size={15} />} {editingId ? 'Update category' : 'Add category'}
            </button>
          </div>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p className="eyebrow">Current groups</p>
            <h2>View categories</h2>
          </div>
          <label className="product-search">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
            />
          </label>
        </div>

        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Products</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length ? (
                filteredCategories.map((category) => {
                  const categoryProducts = productsByCategory[category.id] || [];
                  const isExpanded = expandedCategoryId === category.id;

                  return (
                    <>
                      <tr key={category.id}>
                        <td><strong>{category.name}</strong></td>
                        <td>{category.description || '—'}</td>
                        <td>{categoryProducts.length || category.productCount || 0}</td>
                        <td className="table-actions">
                          <button className="secondary-action" type="button" onClick={() => setExpandedCategoryId(isExpanded ? null : category.id)}>
                            {isExpanded ? 'Hide products' : 'View products'}
                          </button>
                          <button className="icon-button" onClick={() => handleEdit(category)} aria-label={`Edit ${category.name}`}>
                            <Pencil size={15} />
                          </button>
                          <button className="icon-button danger" onClick={() => handleDelete(category.id)} aria-label={`Delete ${category.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="category-detail-row" key={`${category.id}-details`}>
                          <td colSpan="4">
                            <div className="category-product-list">
                              <strong>{category.name}</strong>
                              {categoryProducts.length ? (
                                <div className="category-product-pills">
                                  {categoryProducts.map((product) => (
                                    <span key={product.id} className="category-product-pill">
                                      {product.itemName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="category-empty-state">No products in this category yet.</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              ) : (
                <tr>
                  <td className="empty-products" colSpan="4">No categories yet. Create your first category.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {statusMessage && <div className="success-toast" role="status"><Check size={16} /> {statusMessage}</div>}
      {errorMessage && <div className="auth-error" style={{ marginTop: '14px' }}>{errorMessage}</div>}
    </div>
  );
}

export { CategoriesPage };

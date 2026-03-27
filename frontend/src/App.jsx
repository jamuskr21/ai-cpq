import { useEffect, useMemo, useState } from 'react';
import './App.css';
import * as db from './localDB';

function App() {
  const [config, setConfig] = useState(null);
  const [selection, setSelection] = useState({});
  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [price, setPrice] = useState(null);

  const [mode, setMode] = useState('configure'); // configure | admin
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('car');
  const [adminConfig, setAdminConfig] = useState(null);
  const [constraintsList, setConstraintsList] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  const [productForm, setProductForm] = useState({ productId: '', name: '', basePrice: 0 });
  const [optionForm, setOptionForm] = useState({ optionId: '', label: '', controlType: 'dropdown', required: false });
  const [optionValueRows, setOptionValueRows] = useState([{ value: '', label: '', price: 0 }]);
  const [constraintForm, setConstraintForm] = useState({ type: 'incompatible', optionId: '', optionValue: '', incompatibleOptionId: '', incompatibleOptionValue: '', requiredOptionId: '', requiredOptionValue: '', message: '' });

  const API_KEY = 'secret-admin-key-123';
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await db.getProducts();
        setProducts(data);
        if (data.length > 0) {
          setSelectedProductId((prev) => prev || data[0].id);
        }
      } catch (e) {
        console.error('Failed to load products', e);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;

    const loadConfigForProduct = async () => {
      try {
        const data = await db.getConfig(selectedProductId);
        setConfig(data);
        setSelection({});
      } catch (e) {
        console.error('Failed to load config for product', e);
      }
    };

    const loadAdminConfig = async () => {
      try {
        const cfg = await db.getConfig(selectedProductId);
        setAdminConfig(cfg);

        const constraintsData = await db.getConstraints(selectedProductId);
        setConstraintsList(constraintsData);
      } catch (e) {
        console.error('Failed to load admin config', e);
      }
    };

    loadConfigForProduct();
    loadAdminConfig();
  }, [selectedProductId]);

  const constraints = config?.constraints || [];

  // Validation and pricing helpers
  const validateSelection = (selection, config) => {
    const errors = [];
    
    if (!config) return { valid: true, errors: [] };

    // Check required fields
    for (const option of config.options || []) {
      if (option.required && !selection[option.id]) {
        errors.push({ message: `${option.label} is required.` });
      }
    }

    // Check constraints
    for (const constraint of config.constraints || []) {
      if (constraint.type === 'incompatible') {
        if (selection[constraint.optionId] === constraint.optionValue && selection[constraint.incompatibleOptionId] === constraint.incompatibleOptionValue) {
          errors.push({ message: constraint.message });
        }
      }

      if (constraint.type === 'required') {
        if (selection[constraint.optionId] === constraint.optionValue && selection[constraint.requiredOptionId] !== constraint.requiredOptionValue) {
          errors.push({ message: constraint.message });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  };

  const computePrice = (selection, config) => {
    if (!config) return 0;

    let total = config.product?.basePrice || 0;
    
    for (const option of config.options || []) {
      const selectedValue = selection[option.id];
      if (!selectedValue) continue;

      const value = option.values?.find((v) => v.value === selectedValue);
      if (value) {
        total += value.price;
      }
    }

    return total;
  };

  const refreshProducts = async () => {
    try {
      const data = await db.getProducts();
      setProducts(data);
      if (data.length > 0 && !selectedProductId) {
        setSelectedProductId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to refresh products', e);
    }
  };

  const refreshAdminData = async (productIdParam) => {
    const productId = productIdParam || selectedProductId;
    if (!productId) return;
    try {
      const cfg = await db.getConfig(productId);
      setAdminConfig(cfg);

      const constraintsData = await db.getConstraints(productId);
      setConstraintsList(constraintsData);
    } catch (e) {
      console.error('Failed to refresh admin data', e);
    }
  };

  const onCreateProduct = async () => {
    try {
      await db.createProduct(productForm);
      setStatusMessage('Product created');
      setProductForm({ productId: '', name: '', basePrice: 0 });
      await refreshProducts();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Create product error: ${e.message}`);
    }
  };

  const onCreateOption = async () => {
    const values = optionValueRows
      .filter((row) => row.value.trim())
      .map((row, idx) => ({
        value: row.value,
        label: row.label || row.value,
        price: Number(row.price || 0),
        sortOrder: idx * 100,
      }));

    if (!optionForm.optionId.trim() || !optionForm.label.trim() || values.length === 0) {
      setStatusMessage('Option ID, label, and at least one value are required.');
      return;
    }

    const body = {
      optionId: optionForm.optionId,
      label: optionForm.label,
      controlType: optionForm.controlType,
      required: optionForm.required,
      sortOrder: 100,
      values,
    };

    try {
      await db.createOption(selectedProductId, body);
      setStatusMessage('Option created');
      setOptionForm({ optionId: '', label: '', controlType: 'dropdown', required: false });
      setOptionValueRows([{ value: '', label: '', price: 0 }]);
      await refreshAdminData();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Create option error: ${e.message}`);
    }
  };

  const addOptionRow = () => {
    setOptionValueRows((prev) => [...prev, { value: '', label: '', price: 0 }]);
  };

  const updateOptionRow = (index, field, value) => {
    setOptionValueRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
  };

  const removeOptionRow = (index) => {
    setOptionValueRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const onCreateConstraint = async () => {
    try {
      await db.createConstraint(selectedProductId, constraintForm);
      setStatusMessage('Constraint created');
      setConstraintForm({ type: 'incompatible', optionId: '', optionValue: '', incompatibleOptionId: '', incompatibleOptionValue: '', requiredOptionId: '', requiredOptionValue: '', message: '' });
      await refreshAdminData();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Create constraint error: ${e.message}`);
    }
  };

  const onDeleteOption = async (optionId) => {
    try {
      await db.deleteOption(selectedProductId, optionId);
      setStatusMessage('Option deleted');
      await refreshAdminData();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Delete option error: ${e.message}`);
    }
  };

  const onDeleteOptionValue = async (optionId, value) => {
    try {
      await db.deleteOptionValue(selectedProductId, optionId, value);
      setStatusMessage('Option value deleted');
      await refreshAdminData();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Delete value error: ${e.message}`);
    }
  };

  const onDeleteConstraint = async (constraintId) => {
    try {
      await db.deleteConstraint(constraintId);
      setStatusMessage('Constraint deleted');
      await refreshAdminData();
    } catch (e) {
      console.error(e);
      setStatusMessage(`Delete constraint error: ${e.message}`);
    }
  };

  // Handle selection change with automatic validation/pricing
  const handleSelectChange = (optionId, value) => {
    const nextSelection = { ...selection, [optionId]: value };
    setSelection(nextSelection);
    setValidation(validateSelection(nextSelection, config));
    setPrice(computePrice(nextSelection, config));
  };

  const valueDisabled = (optionId, value) => {
    for (const c of constraints) {
      if (c.type === 'incompatible') {
        if (c.optionId === optionId && c.optionValue === value) {
          const other = selection[c.incompatibleOptionId];
          if (other === c.incompatibleOptionValue) return true;
        }
        if (c.incompatibleOptionId === optionId && c.incompatibleOptionValue === value) {
          const other = selection[c.optionId];
          if (other === c.optionValue) return true;
        }
      }
    }
    return false;
  };

  const optionValues = (option) => option.values || [];

  const summaryItems = useMemo(() => {
    if (!config) return [];
    return config.options
      .filter((opt) => selection[opt.id])
      .map((opt) => ({ label: opt.label, value: selection[opt.id] }));
  }, [config, selection]);

  if (!config) {
    return <div className="App"><h2>Loading config...</h2></div>;
  }

  return (
    <div className="App">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <button className="hamburger" onClick={() => setShowMenu((v) => !v)} aria-label="Menu">
            <span style={{ transform: showMenu ? 'rotate(45deg) translate(3px, 2px)' : 'none' }}></span>
            <span style={{ opacity: showMenu ? 0 : 1 }}></span>
            <span style={{ transform: showMenu ? 'rotate(-45deg) translate(4px, -4px)' : 'none' }}></span>
          </button>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>CPQ Lite</h1>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontWeight: '600' }}>{mode === 'configure' ? 'Configure' : 'Admin'}</span>
          <button className="button-primary" onClick={() => setMode(mode === 'configure' ? 'admin' : 'configure')}>
            {mode === 'configure' ? 'Go Admin' : 'Go Configure'}
          </button>
        </div>
      </div>

      {showMenu && (
        <nav className="menu" style={{position: 'relative'}}>
          <a href="#" onClick={(e) => { e.preventDefault(); setMode('configure'); setShowMenu(false); }}>Configure</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setMode('admin'); setShowMenu(false); }}>Admin</a>
        </nav>
      )}

      <div className="page-tabs">
        <button className={mode === 'configure' ? 'active' : ''} onClick={() => setMode('configure')}>Configure</button>
        <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Admin</button>
      </div>

      {mode === 'configure' ? (
        <>
          <h2 style={{ marginBottom: '0.4rem' }}>Car CPQ Demo</h2>

          <div className="field" style={{ marginBottom: '0.8rem' }}>
            <label>Product</label>
            <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
              ))}
            </select>
          </div>

          <p>Base price: ${config.product.basePrice.toLocaleString()}</p>

          <div className="form-grid">
            {config.options.map((option) => {
          const selectedValue = selection[option.id] || '';

          if (option.controlType === 'textbox') {
            return (
              <div key={option.id} className="field">
                <label>{option.label}</label>
                <input
                  type="text"
                  value={selectedValue}
                  placeholder="Type here"
                  onChange={(e) => handleSelectChange(option.id, e.target.value)}
                />
              </div>
            );
          }

          if (option.controlType === 'radio') {
            return (
              <div key={option.id} className="field">
                <label>{option.label}</label>
                {optionValues(option).map((optValue) => (
                  <label key={optValue.value} className="radio-option">
                    <input
                      type="radio"
                      name={option.id}
                      value={optValue.value}
                      checked={selectedValue === optValue.value}
                      disabled={valueDisabled(option.id, optValue.value)}
                      onChange={() => handleSelectChange(option.id, optValue.value)}
                    />
                    {optValue.label} (+${optValue.price})
                  </label>
                ))}
              </div>
            );
          }

          if (option.controlType === 'typeable-dropdown') {
            return (
              <div key={option.id} className="field">
                <label>{option.label}</label>
                <input
                  list={`list-${option.id}`}
                  value={selectedValue}
                  onChange={(e) => handleSelectChange(option.id, e.target.value)}
                />
                <datalist id={`list-${option.id}`}>
                  {optionValues(option).map((optValue) => (
                    <option key={optValue.value} value={optValue.value} />
                  ))}
                </datalist>
                <small>Suggested: {option.values.map((v) => v.label).join(', ')}</small>
              </div>
            );
          }

          return (
            <div key={option.id} className="field">
              <label>{option.label}</label>
              <select
                value={selectedValue}
                onChange={(e) => handleSelectChange(option.id, e.target.value)}
              >
                <option value="">Select ...</option>
                {optionValues(option).map((optValue) => (
                  <option
                    key={optValue.value}
                    value={optValue.value}
                    disabled={valueDisabled(option.id, optValue.value)}
                  >
                    {optValue.label} (+${optValue.price || 0})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="status">
        <h3>Validation</h3>
        {validation.valid ? (
          <p style={{ color: 'green' }}>Selection is valid.</p>
        ) : (
          <ul style={{ color: 'red' }}>
            {validation.errors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        )}
        <h3>Price</h3>
        {price !== null ? <p>${price.toLocaleString()}</p> : <p>Enter valid configuration to compute price.</p>}
      </div>

      <div className="summary">
        <h3>Current selections</h3>
        <ul>
          {summaryItems.map((item) => (
            <li key={item.label}>{item.label}: {item.value}</li>
          ))}
        </ul>
      </div>
    </>
  ) : (
    <div className="admin-card">
      <h2>Admin Product Management</h2>

      <div className="admin-group">
        <h3>Active product</h3>
        <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
          ))}
        </select>
      </div>

      <div className="admin-group">
        <h3>Add product</h3>
        <input placeholder="Product ID" value={productForm.productId} onChange={(e) => setProductForm({ ...productForm, productId: e.target.value })} />
        <input placeholder="Name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
        <input type="number" placeholder="Base price" value={productForm.basePrice} onChange={(e) => setProductForm({ ...productForm, basePrice: Number(e.target.value) })} />
        <button className="button-primary" onClick={onCreateProduct}>Create product</button>
      </div>

      <div className="admin-group">
        <h3>Options for {selectedProductId}</h3>
        <ul>
          {(adminConfig?.options || []).map((opt) => (
            <li key={opt.id} style={{ marginBottom: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.4rem' }}>
                <span>{opt.label} ({opt.id}, {opt.controlType}) {opt.required && <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span>}</span>
                <button onClick={() => onDeleteOption(opt.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>Delete Option</button>
              </div>
              {opt.values && opt.values.length > 0 && (
                <div style={{ marginLeft: '0.8rem', paddingLeft: '0.8rem', borderLeft: '2px solid #d1d5db' }}>
                  <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.3rem' }}>Values:</div>
                  {opt.values.map((v) => (
                    <div key={v.value} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', fontSize: '0.9rem' }}>
                      <span>{v.label} (${Number(v.price).toFixed(2)})</span>
                      <button onClick={() => onDeleteOptionValue(opt.id, v.value)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="new-option-form">
          <h4>New option</h4>
          <input placeholder="Option ID" value={optionForm.optionId} onChange={(e) => setOptionForm({ ...optionForm, optionId: e.target.value })} />
          <input placeholder="Label" value={optionForm.label} onChange={(e) => setOptionForm({ ...optionForm, label: e.target.value })} />
          <select value={optionForm.controlType} onChange={(e) => setOptionForm({ ...optionForm, controlType: e.target.value })}>
            <option value="dropdown">dropdown</option>
            <option value="radio">radio</option>
            <option value="typeable-dropdown">typeable-dropdown</option>
            <option value="textbox">textbox</option>
          </select>
          <label className="checkbox-label"><input type="checkbox" checked={optionForm.required} onChange={(e) => setOptionForm({ ...optionForm, required: e.target.checked })} /> Required</label>

          <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '0.8rem', marginTop: '0.8rem', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <strong>Values</strong>
            <button className="button-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }} onClick={addOptionRow} type="button">Add value</button>
          </div>
          {optionValueRows.map((row, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <input
                placeholder="Value"
                value={row.value}
                onChange={(e) => updateOptionRow(idx, 'value', e.target.value)}
              />
              <input
                placeholder="Label"
                value={row.label}
                onChange={(e) => updateOptionRow(idx, 'label', e.target.value)}
              />
              <input
                type="number"
                placeholder="Price"
                value={row.price}
                onChange={(e) => updateOptionRow(idx, 'price', e.target.value)}
              />
              <button type="button" onClick={() => removeOptionRow(idx)} style={{ padding: '0.45rem 0.65rem' }}>Remove</button>
            </div>
          ))}
        </div>

          <button className="button-primary" onClick={onCreateOption}>Create Option</button>
        </div>
      </div>

      <div className="admin-group">
        <h3>Constraints for {selectedProductId}</h3>
        <ul>
          {constraintsList.map((c) => (
            <li key={c.ConstraintId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <span>{`${c.ConstraintType}: ${c.OptionId} ${c.OptionValue || ''} => ${c.Message}`}</span>
              <button onClick={() => onDeleteConstraint(c.ConstraintId)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>Delete</button>
            </li>
          ))}
        </ul>

        <div className="new-constraint-form">
          <h4>New constraint</h4>
          <select value={constraintForm.type} onChange={(e) => setConstraintForm({ ...constraintForm, type: e.target.value })}>
            <option value="incompatible">incompatible</option>
            <option value="required">required</option>
          </select>
          <select value={constraintForm.optionId} onChange={(e) => setConstraintForm({ ...constraintForm, optionId: e.target.value })}>
            <option value="">-- Select Option --</option>
            {(adminConfig?.options || []).map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label} ({opt.id})</option>
            ))}
          </select>
          <select value={constraintForm.optionValue} onChange={(e) => setConstraintForm({ ...constraintForm, optionValue: e.target.value })}>
            <option value="">-- Option Value --</option>
            {constraintForm.optionId && 
              (adminConfig?.options || [])
                .find(opt => opt.id === constraintForm.optionId)?.values?.map((val) => (
                  <option key={val.value} value={val.value}>{val.label} (${val.price})</option>
                ))
            }
          </select>
          <select value={constraintForm.incompatibleOptionId} onChange={(e) => setConstraintForm({ ...constraintForm, incompatibleOptionId: e.target.value })}>
            <option value="">-- Incompatible Option --</option>
            {(adminConfig?.options || []).map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label} ({opt.id})</option>
            ))}
          </select>
          <select value={constraintForm.incompatibleOptionValue} onChange={(e) => setConstraintForm({ ...constraintForm, incompatibleOptionValue: e.target.value })}>
            <option value="">-- Incompatible Value --</option>
            {constraintForm.incompatibleOptionId && 
              (adminConfig?.options || [])
                .find(opt => opt.id === constraintForm.incompatibleOptionId)?.values?.map((val) => (
                  <option key={val.value} value={val.value}>{val.label} (${val.price})</option>
                ))
            }
          </select>
          <input placeholder="Message" value={constraintForm.message} onChange={(e) => setConstraintForm({ ...constraintForm, message: e.target.value })} />
          <button className="button-primary" onClick={onCreateConstraint}>Create Constraint</button>
        </div>
      </div>

      <div className="status"><strong>{statusMessage}</strong></div>
    </div>
  )}
</div>
  );
}

export default App;

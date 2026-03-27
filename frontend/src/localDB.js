/**
 * Local Database - Client-side storage using localStorage
 * Replaces backend/db.js for frontend-only POC testing
 * 
 * All data is stored in browser localStorage and persists across sessions
 */

const STORAGE_KEY = 'cpqlite_db';

// Default/fallback data
const defaultData = {
  products: [
    {
      productId: 'car',
      name: 'Car',
      basePrice: 20000,
    },
    {
      productId: 'shoe',
      name: 'Shoe',
      basePrice: 15,
    },
    {
      productId: 'reebok',
      name: 'Reebok',
      basePrice: 25,
    },
  ],
  options: [
    {
      optionId: 'trim',
      productId: 'car',
      label: 'Trim',
      controlType: 'dropdown',
      isRequired: true,
      sortOrder: 0,
    },
    {
      optionId: 'color',
      productId: 'car',
      label: 'Color',
      controlType: 'radio',
      isRequired: true,
      sortOrder: 100,
    },
    {
      optionId: 'tireBrand',
      productId: 'car',
      label: 'Tire Brand',
      controlType: 'typeable-dropdown',
      isRequired: true,
      sortOrder: 200,
    },
    {
      optionId: 'customNotes',
      productId: 'car',
      label: 'Custom Notes',
      controlType: 'textbox',
      isRequired: false,
      sortOrder: 300,
    },
  ],
  optionValues: [
    { productId: 'car', optionId: 'trim', value: 'standard', label: 'Standard', price: 0, sortOrder: 0 },
    { productId: 'car', optionId: 'trim', value: 'sport', label: 'Sport', price: 3500, sortOrder: 100 },
    { productId: 'car', optionId: 'trim', value: 'luxury', label: 'Luxury', price: 7000, sortOrder: 200 },
    { productId: 'car', optionId: 'color', value: 'white', label: 'White', price: 0, sortOrder: 0 },
    { productId: 'car', optionId: 'color', value: 'black', label: 'Black', price: 300, sortOrder: 100 },
    { productId: 'car', optionId: 'color', value: 'red', label: 'Red', price: 500, sortOrder: 200 },
    { productId: 'car', optionId: 'tireBrand', value: 'goodyear', label: 'Goodyear', price: 400, sortOrder: 0 },
    { productId: 'car', optionId: 'tireBrand', value: 'michelin', label: 'Michelin', price: 500, sortOrder: 100 },
    { productId: 'car', optionId: 'tireBrand', value: 'pirelli', label: 'Pirelli', price: 550, sortOrder: 200 },
  ],
  constraints: [
    {
      constraintId: 1,
      productId: 'car',
      constraintType: 'incompatible',
      optionId: 'trim',
      optionValue: 'standard',
      incompatibleOptionId: 'color',
      incompatibleOptionValue: 'red',
      message: 'Red is not available with Standard trim.',
    },
    {
      constraintId: 2,
      productId: 'car',
      constraintType: 'incompatible',
      optionId: 'trim',
      optionValue: 'sport',
      incompatibleOptionId: 'color',
      incompatibleOptionValue: 'red',
      message: 'Red is not available with Sport trim.',
    },
    {
      constraintId: 3,
      productId: 'car',
      constraintType: 'required',
      optionId: 'trim',
      optionValue: 'luxury',
      requiredOptionId: 'tireBrand',
      requiredOptionValue: 'pirelli',
      message: 'Luxury trim requires Pirelli tires.',
    },
  ],
  quotes: [],
};

// Initialize storage
function initDB() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
  }
}

function getDB() {
  initDB();
  const data = localStorage.getItem(STORAGE_KEY);
  return JSON.parse(data);
}

function saveDB(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ============================================================
// DATABASE FUNCTIONS (same API as backend/db.js)
// ============================================================

export async function getConfig(productId = 'car') {
  const db = getDB();
  
  const product = db.products.find(p => p.productId === productId);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const options = db.options
    .filter(o => o.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(opt => {
      const optionValues = db.optionValues
        .filter(v => v.productId === productId && v.optionId === opt.optionId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(v => ({ value: v.value, label: v.label, price: v.price }));

      return {
        id: opt.optionId,
        label: opt.label,
        controlType: opt.controlType,
        required: opt.isRequired,
        values: optionValues,
      };
    });

  const constraints = db.constraints
    .filter(c => c.productId === productId)
    .map(c => ({
      type: c.constraintType,
      optionId: c.optionId,
      optionValue: c.optionValue,
      incompatibleOptionId: c.incompatibleOptionId,
      incompatibleOptionValue: c.incompatibleOptionValue,
      requiredOptionId: c.requiredOptionId,
      requiredOptionValue: c.requiredOptionValue,
      message: c.message,
    }));

  return {
    product: {
      id: product.productId,
      name: product.name,
      basePrice: product.basePrice,
    },
    options,
    constraints,
  };
}

export async function getProducts() {
  const db = getDB();
  return db.products.map(p => ({
    id: p.productId,
    name: p.name,
    basePrice: p.basePrice,
  }));
}

export async function createProduct(product) {
  const db = getDB();
  db.products.push({
    productId: product.productId,
    name: product.name,
    basePrice: product.basePrice,
  });
  saveDB(db);
  return { id: product.productId, name: product.name, basePrice: product.basePrice };
}

export async function updateProduct(productId, product) {
  const db = getDB();
  const idx = db.products.findIndex(p => p.productId === productId);
  if (idx === -1) throw new Error('Product not found');
  db.products[idx] = { productId, ...product };
  saveDB(db);
  return { id: productId, ...product };
}

export async function deleteProduct(productId) {
  const db = getDB();
  db.products = db.products.filter(p => p.productId !== productId);
  db.options = db.options.filter(o => o.productId !== productId);
  db.optionValues = db.optionValues.filter(v => v.productId !== productId);
  db.constraints = db.constraints.filter(c => c.productId !== productId);
  saveDB(db);
  return { id: productId };
}

export async function getOptions(productId) {
  const db = getDB();
  return db.options
    .filter(o => o.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(o => ({
      id: o.optionId,
      label: o.label,
      controlType: o.controlType,
      required: o.isRequired,
      values: db.optionValues
        .filter(v => v.productId === productId && v.optionId === o.optionId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(v => ({ value: v.value, label: v.label, price: v.price })),
    }));
}

export async function createOption(productId, option) {
  const db = getDB();
  
  const maxSortOrder = Math.max(
    0,
    ...db.options.filter(o => o.productId === productId).map(o => o.sortOrder)
  );

  db.options.push({
    optionId: option.optionId,
    productId,
    label: option.label,
    controlType: option.controlType,
    isRequired: option.required || false,
    sortOrder: maxSortOrder + 100,
  });

  // Add values
  if (option.values && Array.isArray(option.values)) {
    option.values.forEach((val, idx) => {
      if (val.value) {
        db.optionValues.push({
          productId,
          optionId: option.optionId,
          value: val.value,
          label: val.label || val.value,
          price: val.price || 0,
          sortOrder: idx * 100,
        });
      }
    });
  }

  saveDB(db);
  return { optionId: option.optionId, ...option };
}

export async function updateOption(optionId, option) {
  const db = getDB();
  const idx = db.options.findIndex(o => o.optionId === optionId);
  if (idx === -1) throw new Error('Option not found');
  db.options[idx] = { ...db.options[idx], label: option.label, controlType: option.controlType };
  saveDB(db);
  return { optionId, ...option };
}

export async function deleteOption(productId, optionId) {
  const db = getDB();
  db.options = db.options.filter(o => !(o.productId === productId && o.optionId === optionId));
  db.optionValues = db.optionValues.filter(v => !(v.productId === productId && v.optionId === optionId));
  saveDB(db);
  return { optionId };
}

export async function deleteOptionValue(productId, optionId, value) {
  const db = getDB();
  db.optionValues = db.optionValues.filter(v => !(v.productId === productId && v.optionId === optionId && v.value === value));
  saveDB(db);
  return { optionId, value };
}

export async function getConstraints(productId) {
  const db = getDB();
  return db.constraints
    .filter(c => c.productId === productId)
    .map(c => ({
      ConstraintId: c.constraintId,
      ConstraintType: c.constraintType,
      OptionId: c.optionId,
      OptionValue: c.optionValue,
      IncompatibleOptionId: c.incompatibleOptionId,
      IncompatibleOptionValue: c.incompatibleOptionValue,
      RequiredOptionId: c.requiredOptionId,
      RequiredOptionValue: c.requiredOptionValue,
      Message: c.message,
    }));
}

export async function createConstraint(productId, constraint) {
  const db = getDB();
  const constraintId = Math.max(0, ...db.constraints.map(c => c.constraintId || 0)) + 1;

  db.constraints.push({
    constraintId,
    productId,
    constraintType: constraint.type,
    optionId: constraint.optionId,
    optionValue: constraint.optionValue,
    incompatibleOptionId: constraint.incompatibleOptionId,
    incompatibleOptionValue: constraint.incompatibleOptionValue,
    requiredOptionId: constraint.requiredOptionId,
    requiredOptionValue: constraint.requiredOptionValue,
    message: constraint.message,
  });

  saveDB(db);
  return { constraintId, ...constraint };
}

export async function updateConstraint(constraintId, constraint) {
  const db = getDB();
  const idx = db.constraints.findIndex(c => c.constraintId === constraintId);
  if (idx === -1) throw new Error('Constraint not found');
  db.constraints[idx] = { ...db.constraints[idx], ...constraint };
  saveDB(db);
  return { constraintId, ...constraint };
}

export async function deleteConstraint(constraintId) {
  const db = getDB();
  db.constraints = db.constraints.filter(c => c.constraintId !== constraintId);
  saveDB(db);
  return { constraintId };
}

export async function saveQuote(productId, customerName, customerEmail, selection, totalPrice) {
  const db = getDB();
  const quoteId = Math.max(0, ...db.quotes.map(q => q.quoteId || 0)) + 1;

  db.quotes.push({
    quoteId,
    productId,
    customerName,
    customerEmail,
    selection,
    totalPrice,
    createdAt: new Date().toISOString(),
  });

  saveDB(db);
  return { quoteId };
}

export async function getQuotes() {
  const db = getDB();
  return db.quotes.map(q => ({
    id: q.quoteId,
    productId: q.productId,
    customerName: q.customerName,
    customerEmail: q.customerEmail,
    totalPrice: q.totalPrice,
    createdAt: q.createdAt,
  }));
}

export async function getQuoteDetails(quoteId) {
  const db = getDB();
  const quote = db.quotes.find(q => q.quoteId === quoteId);
  if (!quote) throw new Error('Quote not found');
  return {
    id: quote.quoteId,
    productId: quote.productId,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    totalPrice: quote.totalPrice,
    createdAt: quote.createdAt,
    selection: quote.selection,
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Reset database to default state
 */
export function resetDatabase() {
  localStorage.removeItem(STORAGE_KEY);
  initDB();
}

/**
 * Export database as JSON
 */
export function exportDatabase() {
  const db = getDB();
  const dataStr = JSON.stringify(db, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cpqlite-db-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Import database from JSON file
 */
export async function importDatabase(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
        resolve(true);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

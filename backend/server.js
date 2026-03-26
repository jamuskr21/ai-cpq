const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

const { getConfig, getProducts, createProduct, updateProduct, deleteProduct, getOptions, createOption, updateOption, deleteOption, deleteOptionValue, getConstraints, createConstraint, updateConstraint, deleteConstraint, saveQuote, getQuotes, getQuoteDetails } = require('./db');

app.use(cors());
app.use(express.json());

// Simple auth middleware for admin routes
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const fallbackConfig = {
  product: { id: 'car', name: 'Car', basePrice: 20000 },
  options: [
    { id: 'trim', label: 'Trim', controlType: 'dropdown', required: true, values: [
      { value: 'standard', label: 'Standard', price: 0 },
      { value: 'sport', label: 'Sport', price: 3500 },
      { value: 'luxury', label: 'Luxury', price: 7000 },
    ] },
    { id: 'color', label: 'Color', controlType: 'radio', required: true, values: [
      { value: 'white', label: 'White', price: 0 },
      { value: 'black', label: 'Black', price: 300 },
      { value: 'red', label: 'Red', price: 500 },
    ] },
    { id: 'tireBrand', label: 'Tire Brand', controlType: 'typeable-dropdown', required: true, values: [
      { value: 'goodyear', label: 'Goodyear', price: 400 },
      { value: 'michelin', label: 'Michelin', price: 500 },
      { value: 'pirelli', label: 'Pirelli', price: 550 },
    ] },
    { id: 'customNotes', label: 'Custom Notes', controlType: 'textbox', required: false },
  ],
  constraints: [
    { type: 'incompatible', optionId: 'trim', optionValue: 'standard', incompatibleOptionId: 'color', incompatibleOptionValue: 'red', message: 'Red is not available with Standard trim.' },
    { type: 'incompatible', optionId: 'trim', optionValue: 'sport', incompatibleOptionId: 'color', incompatibleOptionValue: 'red', message: 'Red is not available with Sport trim.' },
    { type: 'required', optionId: 'trim', optionValue: 'luxury', requiredOptionId: 'tireBrand', requiredOptionValue: 'pirelli', message: 'Luxury trim requires Pirelli tires.' },
  ],
};

const validateSelection = (config, selection) => {
  const errors = [];

  config.options.forEach((option) => {
    if (option.required && (selection[option.id] === undefined || selection[option.id] === '')) {
      errors.push({ optionId: option.id, message: `${option.label} is required.` });
    }
  });

  config.constraints.forEach((constraint) => {
    if (constraint.type === 'incompatible') {
      if (selection[constraint.optionId] === constraint.optionValue && selection[constraint.incompatibleOptionId] === constraint.incompatibleOptionValue) {
        errors.push({ optionId: constraint.incompatibleOptionId, message: constraint.message });
      }
    } else if (constraint.type === 'required') {
      if (selection[constraint.optionId] === constraint.optionValue && selection[constraint.requiredOptionId] !== constraint.requiredOptionValue) {
        errors.push({ optionId: constraint.requiredOptionId, message: constraint.message });
      }
    }
  });

  return errors;
};

const computePrice = (config, selection) => {
  let total = config.product.basePrice;

  config.options.forEach((option) => {
    const value = selection[option.id];
    if (!value) return;
    const matching = (option.values || []).find((v) => v.value === value || v.label === value);
    if (matching && matching.price) total += matching.price;
  });

  return total;
};

async function getConfigOrFallback(productId) {
  try {
    return await getConfig(productId);
  } catch (e) {
    console.warn('DB config load failed, using fallback config', e.message);
    return fallbackConfig;
  }
}

app.get('/api/config', async (req, res) => {
  const productId = req.query.productId || 'car';
  try {
    const config = await getConfigOrFallback(productId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/validate', async (req, res) => {
  const productId = req.query.productId || 'car';
  const selection = req.body;
  try {
    const config = await getConfigOrFallback(productId);
    const errors = validateSelection(config, selection);
    res.json({ valid: errors.length === 0, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/price', async (req, res) => {
  const productId = req.query.productId || 'car';
  const selection = req.body;

  try {
    const config = await getConfigOrFallback(productId);
    const errors = validateSelection(config, selection);
    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }
    const total = computePrice(config, selection);
    res.json({ valid: true, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    console.warn('DB products load failed, returning fallback product', error.message);
    res.json([{ id: fallbackConfig.product.id, name: fallbackConfig.product.name, basePrice: fallbackConfig.product.basePrice }]);
  }
});

app.post('/api/quotes', async (req, res) => {
  const { productId, customerName, customerEmail, selection } = req.body;
  if (!productId || !selection) {
    return res.status(400).json({ error: 'productId and selection required' });
  }

  try {
    const config = await getConfigOrFallback(productId);
    const errors = validateSelection(config, selection);
    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }
    const total = computePrice(config, selection);
    const result = await saveQuote(productId, customerName, customerEmail, selection, total);
    res.json({ ...result, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes', async (req, res) => {
  try {
    const quotes = await getQuotes();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes/:id', async (req, res) => {
  const quoteId = parseInt(req.params.id);
  try {
    const quote = await getQuoteDetails(quoteId);
    res.json(quote);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Admin routes (require x-api-key header)
app.post('/api/admin/products', adminAuth, async (req, res) => {
  const product = req.body;
  if (!product?.productId || !product?.name || product?.basePrice == null) {
    return res.status(400).json({ error: 'productId, name, and basePrice are required' });
  }
  try {
    const created = await createProduct(product);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id', adminAuth, async (req, res) => {
  const productId = req.params.id;
  const product = req.body;
  if (!product?.name || product?.basePrice == null) {
    return res.status(400).json({ error: 'name and basePrice are required' });
  }
  try {
    const updated = await updateProduct(productId, product);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  const productId = req.params.id;
  try {
    const deleted = await deleteProduct(productId);
    res.json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/products/:id/options', adminAuth, async (req, res) => {
  const productId = req.params.id;
  try {
    const options = await getOptions(productId);
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products/:id/options', adminAuth, async (req, res) => {
  const productId = req.params.id;
  const option = req.body;
  if (!option?.optionId || !option?.label || !option?.controlType) {
    return res.status(400).json({ error: 'optionId, label, and controlType are required' });
  }
  try {
    const created = await createOption(productId, option);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id/options/:optionId', adminAuth, async (req, res) => {
  const optionId = req.params.optionId;
  const option = req.body;
  if (!option?.label || !option?.controlType) {
    return res.status(400).json({ error: 'label and controlType are required' });
  }
  try {
    const updated = await updateOption(optionId, option);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id/options/:optionId', adminAuth, async (req, res) => {
  const optionId = req.params.optionId;
  try {
    const deleted = await deleteOption(optionId);
    res.json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id/options/:optionId/values/:valueId', adminAuth, async (req, res) => {
  const optionId = req.params.optionId;
  const valueId = req.params.valueId;
  try {
    const deleted = await deleteOptionValue(optionId, valueId);
    res.json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/admin/products/:id/constraints', adminAuth, async (req, res) => {
  const productId = req.params.id;
  try {
    const constraints = await getConstraints(productId);
    res.json(constraints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products/:id/constraints', adminAuth, async (req, res) => {
  const productId = req.params.id;
  const constraint = req.body;
  if (!constraint?.type || !constraint?.optionId || !constraint?.message) {
    return res.status(400).json({ error: 'type, optionId, and message are required' });
  }
  try {
    const created = await createConstraint(productId, constraint);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/products/:id/constraints/:constraintId', adminAuth, async (req, res) => {
  const constraintId = parseInt(req.params.constraintId);
  const constraint = req.body;
  if (!constraint?.type || !constraint?.optionId || !constraint?.message) {
    return res.status(400).json({ error: 'type, optionId, and message are required' });
  }
  try {
    const updated = await updateConstraint(constraintId, constraint);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/products/:id/constraints/:constraintId', adminAuth, async (req, res) => {
  const constraintId = parseInt(req.params.constraintId);
  try {
    const deleted = await deleteConstraint(constraintId);
    res.json(deleted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/quotes', adminAuth, async (req, res) => {
  try {
    const quotes = await getQuotes();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

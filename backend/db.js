const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_DATABASE || 'CPQLite',
  options: {
    trustServerCertificate: process.env.DB_TRUSTED_CONNECTION === 'true' || false,
    encrypt: process.env.DB_ENCRYPT === 'true' || false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

async function getConfig(productId = 'car') {
  const db = await getPool();

  const productResult = await db.request().input('productId', sql.NVarChar(100), productId).query(
    `SELECT ProductId, Name, BasePrice FROM Products WHERE ProductId = @productId`);

  if (productResult.recordset.length === 0) {
    throw new Error(`Product ${productId} not found`);
  }

  const product = productResult.recordset[0];

  const optionsResult = await db.request().input('productId', sql.NVarChar(100), productId).query(
    `SELECT OptionId, Label, ControlType, IsRequired, SortOrder FROM Options WHERE ProductId = @productId ORDER BY SortOrder`);

  const optionIds = optionsResult.recordset.map((r) => r.OptionId);

  let values = [];
  if (optionIds.length > 0) {
    const sanitizedIds = optionIds.map((id) => id.replace("'", "''")).map((id) => `'${id}'`).join(',');
    const valuesResult = await db.request().query(`SELECT OptionId, Value, Label, Price, SortOrder FROM OptionValues WHERE OptionId IN (${sanitizedIds}) ORDER BY OptionId, SortOrder`);
    values = valuesResult.recordset;
  }

  const constraintsResult = await db.request().input('productId', sql.NVarChar(100), productId).query(
    `SELECT ConstraintType, OptionId, OptionValue, IncompatibleOptionId, IncompatibleOptionValue, RequiredOptionId, RequiredOptionValue, Message FROM OptionConstraints WHERE ProductId = @productId`);

  const options = optionsResult.recordset.map((opt) => {
    const optionValues = values.filter((v) => v.OptionId === opt.OptionId).map((v) => ({ value: v.Value, label: v.Label, price: Number(v.Price) }));
    return {
      id: opt.OptionId,
      label: opt.Label,
      controlType: opt.ControlType,
      required: opt.IsRequired === 1,
      values: optionValues,
    };
  });

  const constraints = constraintsResult.recordset.map((c) => {
    const mapped = {
      type: c.ConstraintType,
      optionId: c.OptionId,
      optionValue: c.OptionValue,
      message: c.Message,
    };
    if (c.ConstraintType === 'incompatible') {
      mapped.incompatibleOptionId = c.IncompatibleOptionId;
      mapped.incompatibleOptionValue = c.IncompatibleOptionValue;
    } else if (c.ConstraintType === 'required') {
      mapped.requiredOptionId = c.RequiredOptionId;
      mapped.requiredOptionValue = c.RequiredOptionValue;
    }
    return mapped;
  });

  return {
    product: {
      id: product.ProductId,
      name: product.Name,
      basePrice: Number(product.BasePrice),
    },
    options,
    constraints,
  };
}

async function getProducts() {
  const db = await getPool();
  const result = await db.request().query('SELECT ProductId, Name, BasePrice FROM Products ORDER BY Name');
  return result.recordset.map(p => ({ id: p.ProductId, name: p.Name, basePrice: Number(p.BasePrice) }));
}

async function createProduct(product) {
  const db = await getPool();
  await db.request()
    .input('productId', sql.NVarChar(100), product.productId)
    .input('name', sql.NVarChar(255), product.name)
    .input('basePrice', sql.Decimal(18,2), product.basePrice)
    .query('INSERT INTO Products (ProductId, Name, BasePrice) VALUES (@productId, @name, @basePrice)');
  return { id: product.productId, name: product.name, basePrice: Number(product.basePrice) };
}

async function updateProduct(productId, product) {
  const db = await getPool();
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .input('name', sql.NVarChar(255), product.name)
    .input('basePrice', sql.Decimal(18,2), product.basePrice)
    .query('UPDATE Products SET Name = @name, BasePrice = @basePrice WHERE ProductId = @productId');
  return { id: productId, name: product.name, basePrice: Number(product.basePrice) };
}

async function deleteProduct(productId) {
  const db = await getPool();
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM QuoteLines WHERE QuoteId IN (SELECT QuoteId FROM Quotes WHERE ProductId = @productId)');
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM Quotes WHERE ProductId = @productId');
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM OptionValues WHERE OptionId IN (SELECT OptionId FROM Options WHERE ProductId = @productId)');
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM Options WHERE ProductId = @productId');
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM OptionConstraints WHERE ProductId = @productId');
  await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('DELETE FROM Products WHERE ProductId = @productId');
  return { id: productId };
}

async function getOptions(productId) {
  const db = await getPool();
  const result = await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('SELECT OptionId, Label, ControlType, IsRequired, SortOrder FROM Options WHERE ProductId = @productId ORDER BY SortOrder');
  return result.recordset.map(o => ({
    optionId: o.OptionId,
    label: o.Label,
    controlType: o.ControlType,
    required: o.IsRequired === 1,
    sortOrder: o.SortOrder,
  }));
}

async function createOption(productId, option) {
  const db = await getPool();
  await db.request()
    .input('optionId', sql.NVarChar(100), option.optionId)
    .input('productId', sql.NVarChar(100), productId)
    .input('label', sql.NVarChar(255), option.label)
    .input('controlType', sql.NVarChar(50), option.controlType)
    .input('isRequired', sql.Bit, option.required ? 1 : 0)
    .input('sortOrder', sql.Int, option.sortOrder || 0)
    .query('INSERT INTO Options (OptionId, ProductId, Label, ControlType, IsRequired, SortOrder) VALUES (@optionId, @productId, @label, @controlType, @isRequired, @sortOrder)');

  if (Array.isArray(option.values)) {
    for (const value of option.values) {
      await db.request()
        .input('optionId', sql.NVarChar(100), option.optionId)
        .input('value', sql.NVarChar(100), value.value)
        .input('label', sql.NVarChar(255), value.label)
        .input('price', sql.Decimal(18,2), value.price || 0)
        .input('sortOrder', sql.Int, value.sortOrder || 0)
        .query('INSERT INTO OptionValues (OptionId, Value, Label, Price, SortOrder) VALUES (@optionId, @value, @label, @price, @sortOrder)');
    }
  }

  return { optionId: option.optionId, ...option };
}

async function updateOption(optionId, option) {
  const db = await getPool();
  await db.request()
    .input('optionId', sql.NVarChar(100), optionId)
    .input('label', sql.NVarChar(255), option.label)
    .input('controlType', sql.NVarChar(50), option.controlType)
    .input('isRequired', sql.Bit, option.required ? 1 : 0)
    .input('sortOrder', sql.Int, option.sortOrder || 0)
    .query('UPDATE Options SET Label = @label, ControlType = @controlType, IsRequired = @isRequired, SortOrder = @sortOrder WHERE OptionId = @optionId');

  if (Array.isArray(option.values)) {
    await db.request()
      .input('optionId', sql.NVarChar(100), optionId)
      .query('DELETE FROM OptionValues WHERE OptionId = @optionId');
    for (const value of option.values) {
      await db.request()
        .input('optionId', sql.NVarChar(100), optionId)
        .input('value', sql.NVarChar(100), value.value)
        .input('label', sql.NVarChar(255), value.label)
        .input('price', sql.Decimal(18,2), value.price || 0)
        .input('sortOrder', sql.Int, value.sortOrder || 0)
        .query('INSERT INTO OptionValues (OptionId, Value, Label, Price, SortOrder) VALUES (@optionId, @value, @label, @price, @sortOrder)');
    }
  }

  return { optionId, ...option };
}

async function deleteOption(optionId) {
  const db = await getPool();
  await db.request()
    .input('optionId', sql.NVarChar(100), optionId)
    .query('DELETE FROM OptionValues WHERE OptionId = @optionId');
  await db.request()
    .input('optionId', sql.NVarChar(100), optionId)
    .query('DELETE FROM Options WHERE OptionId = @optionId');
  return { optionId };
}

async function deleteOptionValue(optionId, value) {
  const db = await getPool();
  await db.request()
    .input('optionId', sql.NVarChar(100), optionId)
    .input('value', sql.NVarChar(100), value)
    .query('DELETE FROM OptionValues WHERE OptionId = @optionId AND Value = @value');
  return { optionId, value };
}

async function getConstraints(productId) {
  const db = await getPool();
  const result = await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .query('SELECT ConstraintId, ConstraintType, OptionId, OptionValue, IncompatibleOptionId, IncompatibleOptionValue, RequiredOptionId, RequiredOptionValue, Message FROM OptionConstraints WHERE ProductId = @productId ORDER BY ConstraintId');
  return result.recordset;
}

async function createConstraint(productId, constraint) {
  const db = await getPool();
  const result = await db.request()
    .input('productId', sql.NVarChar(100), productId)
    .input('constraintType', sql.NVarChar(20), constraint.type)
    .input('optionId', sql.NVarChar(100), constraint.optionId)
    .input('optionValue', sql.NVarChar(100), constraint.optionValue || null)
    .input('incompatibleOptionId', sql.NVarChar(100), constraint.incompatibleOptionId || null)
    .input('incompatibleOptionValue', sql.NVarChar(100), constraint.incompatibleOptionValue || null)
    .input('requiredOptionId', sql.NVarChar(100), constraint.requiredOptionId || null)
    .input('requiredOptionValue', sql.NVarChar(100), constraint.requiredOptionValue || null)
    .input('message', sql.NVarChar(1000), constraint.message)
    .query('INSERT INTO OptionConstraints (ProductId, ConstraintType, OptionId, OptionValue, IncompatibleOptionId, IncompatibleOptionValue, RequiredOptionId, RequiredOptionValue, Message) OUTPUT INSERTED.ConstraintId VALUES (@productId, @constraintType, @optionId, @optionValue, @incompatibleOptionId, @incompatibleOptionValue, @requiredOptionId, @requiredOptionValue, @message)');
  return { constraintId: result.recordset[0].ConstraintId, ...constraint };
}

async function updateConstraint(constraintId, constraint) {
  const db = await getPool();
  await db.request()
    .input('constraintId', sql.Int, constraintId)
    .input('constraintType', sql.NVarChar(20), constraint.type)
    .input('optionId', sql.NVarChar(100), constraint.optionId)
    .input('optionValue', sql.NVarChar(100), constraint.optionValue || null)
    .input('incompatibleOptionId', sql.NVarChar(100), constraint.incompatibleOptionId || null)
    .input('incompatibleOptionValue', sql.NVarChar(100), constraint.incompatibleOptionValue || null)
    .input('requiredOptionId', sql.NVarChar(100), constraint.requiredOptionId || null)
    .input('requiredOptionValue', sql.NVarChar(100), constraint.requiredOptionValue || null)
    .input('message', sql.NVarChar(1000), constraint.message)
    .query('UPDATE OptionConstraints SET ConstraintType=@constraintType, OptionId=@optionId, OptionValue=@optionValue, IncompatibleOptionId=@incompatibleOptionId, IncompatibleOptionValue=@incompatibleOptionValue, RequiredOptionId=@requiredOptionId, RequiredOptionValue=@requiredOptionValue, Message=@message WHERE ConstraintId=@constraintId');
  return { constraintId, ...constraint };
}

async function deleteConstraint(constraintId) {
  const db = await getPool();
  await db.request()
    .input('constraintId', sql.Int, constraintId)
    .query('DELETE FROM OptionConstraints WHERE ConstraintId = @constraintId');
  return { constraintId };
}

async function saveQuote(productId, customerName, customerEmail, selection, totalPrice) {
  const db = await getPool();
  const transaction = new sql.Transaction(db);
  await transaction.begin();

  try {
    const quoteResult = await transaction.request()
      .input('productId', sql.NVarChar(100), productId)
      .input('customerName', sql.NVarChar(255), customerName)
      .input('customerEmail', sql.NVarChar(255), customerEmail)
      .input('totalPrice', sql.Decimal(18,2), totalPrice)
      .query('INSERT INTO Quotes (ProductId, CustomerName, CustomerEmail, TotalPrice) OUTPUT INSERTED.QuoteId VALUES (@productId, @customerName, @customerEmail, @totalPrice)');

    const quoteId = quoteResult.recordset[0].QuoteId;

    for (const [optionId, value] of Object.entries(selection)) {
      const config = await getConfig(productId);
      const option = config.options.find(o => o.id === optionId);
      if (!option) continue;
      const val = option.values.find(v => v.value === value || v.label === value);
      const price = val ? val.price : 0;

      await transaction.request()
        .input('quoteId', sql.Int, quoteId)
        .input('optionId', sql.NVarChar(100), optionId)
        .input('selectedValue', sql.NVarChar(100), value)
        .input('price', sql.Decimal(18,2), price)
        .query('INSERT INTO QuoteLines (QuoteId, OptionId, SelectedValue, Price) VALUES (@quoteId, @optionId, @selectedValue, @price)');
    }

    await transaction.commit();
    return { quoteId };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getQuotes() {
  const db = await getPool();
  const result = await db.request().query(`
    SELECT q.QuoteId, q.ProductId, p.Name as ProductName, q.CustomerName, q.CustomerEmail, q.TotalPrice, q.CreatedAt
    FROM Quotes q
    JOIN Products p ON q.ProductId = p.ProductId
    ORDER BY q.CreatedAt DESC
  `);
  return result.recordset.map(q => ({
    id: q.QuoteId,
    productId: q.ProductId,
    productName: q.ProductName,
    customerName: q.CustomerName,
    customerEmail: q.CustomerEmail,
    totalPrice: Number(q.TotalPrice),
    createdAt: q.CreatedAt
  }));
}

async function getQuoteDetails(quoteId) {
  const db = await getPool();
  const quoteResult = await db.request().input('quoteId', sql.Int, quoteId).query(`
    SELECT q.QuoteId, q.ProductId, p.Name as ProductName, q.CustomerName, q.CustomerEmail, q.TotalPrice, q.CreatedAt
    FROM Quotes q
    JOIN Products p ON q.ProductId = p.ProductId
    WHERE q.QuoteId = @quoteId
  `);
  if (quoteResult.recordset.length === 0) throw new Error('Quote not found');

  const linesResult = await db.request().input('quoteId', sql.Int, quoteId).query(`
    SELECT OptionId, SelectedValue, Price FROM QuoteLines WHERE QuoteId = @quoteId
  `);

  const quote = quoteResult.recordset[0];
  return {
    id: quote.QuoteId,
    productId: quote.ProductId,
    productName: quote.ProductName,
    customerName: quote.CustomerName,
    customerEmail: quote.CustomerEmail,
    totalPrice: Number(quote.TotalPrice),
    createdAt: quote.CreatedAt,
    lines: linesResult.recordset.map(l => ({
      optionId: l.OptionId,
      selectedValue: l.SelectedValue,
      price: Number(l.Price)
    }))
  };
}

module.exports = {
  getConfig,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOptions,
  createOption,
  updateOption,
  deleteOption,
  deleteOptionValue,
  getConstraints,
  createConstraint,
  updateConstraint,
  deleteConstraint,
  saveQuote,
  getQuotes,
  getQuoteDetails,
};
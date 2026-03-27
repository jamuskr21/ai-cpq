# Frontend-Only POC Deployment Guide

This guide explains how to deploy your CPQ application as a **frontend-only POC** using Cloudflare Pages without any backend server.

## Overview

Your app now uses **local browser storage** (localStorage) instead of a backend API. This means:

✅ **No backend server needed**
✅ **Zero maintenance** - just static files on Cloudflare Pages
✅ **Data persists** across browser sessions on the same device
✅ **Perfect for POC/demo** testing and evaluation
✅ **All features work offline** - configure, validate, price, admin management

## Architecture

```
Browser (Cloudflare Pages)
├── frontend/src/App.jsx (React app)
├── frontend/src/localDB.js (client-side database)
└── localStorage (browser storage)
```

All data lives in the browser's localStorage. No API calls are made.

## How Local Storage Works

### Data Structure
Your database includes:
- **Products**: Product definitions with base prices
- **Options**: Configuration options (dropdown, radio, textbox, typeable-dropdown)
- **Option Values**: Prices and labels for each option
- **Constraints**: Business rules (incompatible pairs, required combinations)
- **Quotes**: Saved customer quotes

### Default Sample Data
The app comes with sample car configuration data:
- Product: Car (base price $20,000)
- Options: Trim, Color, Tire Brand, Custom Notes
- Values: Standard/Sport/Luxury, White/Black/Red, Goodyear/Michelin/Pirelli
- Constraints: Luxury trim requires Pirelli tires, etc.

### Persistence
- Data automatically saves to localStorage when you create/modify items in Admin
- Data persists across browser tabs and sessions
- Data is device-specific (not synced across devices)
- Clear browser data to reset to defaults

## Deployment Steps

### Step 1: Deploy to Cloudflare Pages

1. **Push your repo to GitHub**
   ```bash
   git add .
   git commit -m "Add local database for POC"
   git push origin main
   ```

2. **Go to Cloudflare Dashboard**
   - Pages → Connect to Git
   - Select your repository
   - Use build settings:
     - **Build command**: `npm install && npm run build`
     - **Build output directory**: `frontend/dist`
     - **Root directory**: `./` (or `.` if required)

3. **Deploy**
   - Cloudflare will automatically build and deploy
   - You'll get a public URL like: `https://your-project.pages.dev`

### Step 2: Test the App

1. **Configure Mode**
   - Visit your Cloudflare Pages URL
   - Select a product
   - Configure options and see real-time validation
   - View the calculated price
   - Make selections to see constraints in action

2. **Admin Mode**
   - Click "Admin" tab
   - Create new products, options, and constraints
   - Delete existing options and values
   - All changes save to localStorage

3. **Persistence Test**
   - Create a new product in Admin
   - Refresh the page - it should still be there
   - Close and reopen the browser - it should still be there

## Available Functions

### In Admin Mode

**Create Product**
- Set Product ID, Name, Base Price
- Products appear in Configure mode

**Create Option**
- Set Option ID, Label, Control Type
- Add option values with prices
- Options appear when product selected

**Create Constraint**
- Link options with business rules
- Incompatible: Disable option values based on other selections
- Required: Force selection of value when condition met

**Delete**
- Remove options and option values
- Remove constraints
- Remove entire products

### In Configure Mode

**Select & Price**
- Choose options based on available values
- Real-time validation against constraints
- Price updates as you select
- Current selections displayed in summary

## Utility Functions

The `localDB.js` module includes utilities for data management:

```javascript
// Database functions
import * as db from './localDB';

await db.getProducts()              // Get all products
await db.getConfig(productId)       // Get product with options & constraints
await db.createProduct(product)     // Create product
await db.deleteProduct(productId)   // Delete product
// ... and options, constraints management

// Utility functions
db.resetDatabase()       // Reset to default sample data
db.exportDatabase()      // Download database as JSON file
db.importDatabase(file)  // Import database from JSON file
```

## Backup & Restore

### Export Your Configuration

1. Open browser DevTools (F12)
2. Go to Console
3. Run:
   ```javascript
   import * as db from './src/localDB.js';
   db.exportDatabase();
   ```
4. A JSON file downloads with all your data

### Import Configuration

1. Click Admin tab
2. Look for import option (can be added to UI)
3. Or use DevTools Console:
   ```javascript
   const file = /* selected file */;
   import * as db from './src/localDB.js';
   db.importDatabase(file);
   ```

### Reset to Defaults

In DevTools Console:
```javascript
import * as db from './src/localDB.js';
db.resetDatabase();
```

## Limitations & Notes

1. **Single Device**: Data doesn't sync across devices/browsers
2. **Storage Limit**: Browser localStorage limited to ~5-10MB (sufficient for typical POC configs)
3. **No Server**: Can't access external APIs or databases
4. **Demo Data**: Comes with car configuration sample
5. **No Authentication**: All users have full admin access (fine for POC)

## Next Steps: To Production

When ready to move beyond POC:

1. **Add Backend API**
   - Use backend/server.js and backend/db.js
   - Deploy to Railway, Render, or Heroku
   - Update App.jsx to call /api/* endpoints

2. **Use Cloudflare Functions**
   - See [CLOUDFLARE_MIGRATION.md](./CLOUDFLARE_MIGRATION.md) for wrapper pattern
   - Use functions/ directory for serverless gateway

3. **Add Real Database**
   - SQL Server, PostgreSQL, MongoDB, etc.
   - Update db.js queries for your database
   - Add proper authentication & authorization

## Troubleshooting

### Data Disappeared After Refresh
- Check if browser cleared localStorage
- Check DevTools → Application → Local Storage
- Look for key: `cpqlite_db`

### Import/Export Not Working
- Use browser DevTools Console directly
- Ensure file is valid JSON format
- Check browser permissions for downloads

### Constraints Not Working
- Verify constraint values match exactly (case-sensitive)
- Check both option IDs and values in constraint form
- Test in Configure mode by selecting conflicting options

## Example Commands (DevTools Console)

```javascript
// Check current data
const db = JSON.parse(localStorage.getItem('cpqlite_db'));
console.log(db.products);
console.log(db.options);

// Clear specific product
db.products = db.products.filter(p => p.productId !== 'car');
localStorage.setItem('cpqlite_db', JSON.stringify(db));

// View all quotes
console.log(db.quotes);
```

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Verify localStorage data exists
3. Review sample data structure in localDB.js
4. Check CORS headers if adding backend later

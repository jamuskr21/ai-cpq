-- Create database and schema for CPQ
-- Run in SQL Server Management Studio or sqlcmd as admin

IF DB_ID('CPQLite') IS NULL
BEGIN
    CREATE DATABASE CPQLite;
END
GO

USE CPQLite;
GO

-- Products table (generic configurable product types)
IF OBJECT_ID('dbo.Products', 'U') IS NULL
BEGIN
CREATE TABLE dbo.Products (
    ProductId NVARCHAR(100) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    BasePrice DECIMAL(18,2) NOT NULL
);
END
GO

-- Options for products
IF OBJECT_ID('dbo.Options', 'U') IS NULL
BEGIN
CREATE TABLE dbo.Options (
    OptionId NVARCHAR(100) PRIMARY KEY,
    ProductId NVARCHAR(100) NOT NULL,
    Label NVARCHAR(255) NOT NULL,
    ControlType NVARCHAR(50) NOT NULL,
    IsRequired BIT NOT NULL DEFAULT 0,
    SortOrder INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_Options_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
);
END
GO

-- Option values (for dropdown/radio/typeable dropdown suggestions)
IF OBJECT_ID('dbo.OptionValues', 'U') IS NULL
BEGIN
CREATE TABLE dbo.OptionValues (
    OptionValueId INT IDENTITY(1,1) PRIMARY KEY,
    OptionId NVARCHAR(100) NOT NULL,
    Value NVARCHAR(100) NOT NULL,
    Label NVARCHAR(255) NOT NULL,
    Price DECIMAL(18,2) NOT NULL DEFAULT 0,
    SortOrder INT NOT NULL DEFAULT 0,
    CONSTRAINT FK_OptionValues_Options FOREIGN KEY (OptionId) REFERENCES dbo.Options(OptionId)
);
END
GO

-- Constraints between options
IF OBJECT_ID('dbo.OptionConstraints', 'U') IS NULL
BEGIN
CREATE TABLE dbo.OptionConstraints (
    ConstraintId INT IDENTITY(1,1) PRIMARY KEY,
    ProductId NVARCHAR(100) NOT NULL,
    ConstraintType NVARCHAR(20) NOT NULL,
    OptionId NVARCHAR(100) NOT NULL,
    OptionValue NVARCHAR(100),
    IncompatibleOptionId NVARCHAR(100),
    IncompatibleOptionValue NVARCHAR(100),
    RequiredOptionId NVARCHAR(100),
    RequiredOptionValue NVARCHAR(100),
    Message NVARCHAR(1000) NOT NULL,
    CONSTRAINT FK_OptionConstraints_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
);
END
GO

-- Seed sample data (car)
IF NOT EXISTS (SELECT 1 FROM dbo.Products WHERE ProductId='car')
BEGIN
    INSERT INTO dbo.Products (ProductId, Name, BasePrice) VALUES ('car', 'Car', 20000);
    INSERT INTO dbo.Options (OptionId, ProductId, Label, ControlType, IsRequired, SortOrder) VALUES
      ('trim', 'car', 'Trim', 'dropdown', 1, 10),
      ('color', 'car', 'Color', 'radio', 1, 20),
      ('tireBrand', 'car', 'Tire Brand', 'typeable-dropdown', 1, 30),
      ('customNotes', 'car', 'Custom Notes', 'textbox', 0, 40);

    INSERT INTO dbo.OptionValues (OptionId, Value, Label, Price, SortOrder) VALUES
      ('trim','standard','Standard',0,100),
      ('trim','sport','Sport',3500,200),
      ('trim','luxury','Luxury',7000,300),
      ('color','white','White',0,100),
      ('color','black','Black',300,200),
      ('color','red','Red',500,300),
      ('tireBrand','goodyear','Goodyear',400,100),
      ('tireBrand','michelin','Michelin',500,200),
      ('tireBrand','pirelli','Pirelli',550,300);

-- Quotes table for saved configurations
IF OBJECT_ID('dbo.Quotes', 'U') IS NULL
BEGIN
CREATE TABLE dbo.Quotes (
    QuoteId INT IDENTITY(1,1) PRIMARY KEY,
    ProductId NVARCHAR(100) NOT NULL,
    CustomerName NVARCHAR(255),
    CustomerEmail NVARCHAR(255),
    TotalPrice DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Quotes_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
);
END
GO

-- Quote lines for selected options
IF OBJECT_ID('dbo.QuoteLines', 'U') IS NULL
BEGIN
CREATE TABLE dbo.QuoteLines (
    QuoteLineId INT IDENTITY(1,1) PRIMARY KEY,
    QuoteId INT NOT NULL,
    OptionId NVARCHAR(100) NOT NULL,
    SelectedValue NVARCHAR(100) NOT NULL,
    Price DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT FK_QuoteLines_Quotes FOREIGN KEY (QuoteId) REFERENCES dbo.Quotes(QuoteId)
);
END
GO

-- Migrations table for schema versioning
IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
BEGIN
CREATE TABLE dbo.SchemaMigrations (
    MigrationId NVARCHAR(255) PRIMARY KEY,
    AppliedAt DATETIME2 DEFAULT GETDATE()
);
END
GO

-- Insert initial migration
IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId='initial_schema')
BEGIN
    INSERT INTO dbo.SchemaMigrations (MigrationId) VALUES ('initial_schema');
END
GO

-- Add new tables for quotes and migrations
USE CPQLite;
GO

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

IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE MigrationId='add_quotes')
BEGIN
    INSERT INTO dbo.SchemaMigrations (MigrationId) VALUES ('add_quotes');
END
GO
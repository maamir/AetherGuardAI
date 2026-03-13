use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    // Set up logging
    tracing_subscriber::fmt::init();
    
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| {
            "postgresql://aetherguard:password@localhost:5432/aetherguard".to_string()
        });

    println!("Connecting to: {}", database_url);

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("✅ Database connection established");

    // Test 1: Basic connectivity
    let result = sqlx::query("SELECT 1 as test_value")
        .fetch_one(&pool)
        .await?;
    
    let test_value: i32 = result.try_get("test_value")?;
    println!("✅ Basic query works: {}", test_value);

    // Test 2: Check current database and user
    let result = sqlx::query("SELECT current_database(), current_user")
        .fetch_one(&pool)
        .await?;
    
    let db_name: String = result.try_get("current_database")?;
    let user_name: String = result.try_get("current_user")?;
    println!("✅ Connected to database '{}' as user '{}'", db_name, user_name);

    // Test 3: Check if tenants table exists
    let result = sqlx::query(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'tenants'
        ) as table_exists"
    )
    .fetch_one(&pool)
    .await?;
    
    let table_exists: bool = result.try_get("table_exists")?;
    println!("✅ Tenants table exists: {}", table_exists);

    // Test 4: Check search path
    let result = sqlx::query("SHOW search_path")
        .fetch_one(&pool)
        .await?;
    
    let search_path: String = result.try_get("search_path")?;
    println!("✅ Search path: {}", search_path);

    // Test 5: Count tenants (without schema)
    let result = sqlx::query("SELECT COUNT(*) as tenant_count FROM tenants")
        .fetch_one(&pool)
        .await?;
    
    let tenant_count: i64 = result.try_get("tenant_count")?;
    println!("✅ Tenant count (no schema): {}", tenant_count);

    // Test 6: Count tenants (with explicit schema)
    let result = sqlx::query("SELECT COUNT(*) as tenant_count FROM public.tenants")
        .fetch_one(&pool)
        .await?;
    
    let tenant_count: i64 = result.try_get("tenant_count")?;
    println!("✅ Tenant count (public schema): {}", tenant_count);

    // Test 7: List all tenants (with explicit schema)
    let rows = sqlx::query("SELECT id, name FROM public.tenants ORDER BY name")
        .fetch_all(&pool)
        .await?;
    
    println!("✅ Tenants found:");
    for row in rows {
        let id: uuid::Uuid = row.try_get("id")?;
        let name: String = row.try_get("name")?;
        println!("  - {} ({})", name, id);
    }

    // Test 8: Check if there are any tables in other schemas
    let rows = sqlx::query(
        "SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'tenants'"
    )
    .fetch_all(&pool)
    .await?;
    
    println!("✅ Tenants tables in all schemas:");
    for row in rows {
        let schema: String = row.try_get("schemaname")?;
        let table: String = row.try_get("tablename")?;
        println!("  - {}.{}", schema, table);
    }

    // Test 9: Check transaction isolation level
    let result = sqlx::query("SHOW transaction_isolation")
        .fetch_one(&pool)
        .await?;
    
    let isolation: String = result.try_get("transaction_isolation")?;
    println!("✅ Transaction isolation: {}", isolation);

    // Test 10: Check if we're in a transaction
    let result = sqlx::query("SELECT txid_current_if_assigned() as txid")
        .fetch_one(&pool)
        .await?;
    
    let txid: Option<i64> = result.try_get("txid")?;
    println!("✅ Current transaction ID: {:?}", txid);

    // Test 11: Try to insert a test tenant
    println!("\n--- Testing INSERT capability ---");
    let test_tenant_id = uuid::Uuid::new_v4();
    let insert_result = sqlx::query(
        "INSERT INTO tenants (id, name, email, password_hash, company, tier, status, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())"
    )
    .bind(test_tenant_id)
    .bind("Rust Test Tenant")
    .bind("rust-test@example.com")
    .bind("dummy_hash")
    .bind("Test Company")
    .bind("free")
    .bind("active")
    .execute(&pool)
    .await;

    match insert_result {
        Ok(result) => {
            println!("✅ Insert successful: {} rows affected", result.rows_affected());
            
            // Now try to read it back
            let read_result = sqlx::query("SELECT COUNT(*) as count FROM tenants WHERE id = $1")
                .bind(test_tenant_id)
                .fetch_one(&pool)
                .await?;
            
            let count: i64 = read_result.try_get("count")?;
            println!("✅ Can read back inserted tenant: {}", count);
            
            // Try to read all tenants again
            let all_count = sqlx::query("SELECT COUNT(*) as count FROM tenants")
                .fetch_one(&pool)
                .await?;
            
            let total: i64 = all_count.try_get("count")?;
            println!("✅ Total tenants after insert: {}", total);
            
            // Clean up - delete the test tenant
            let delete_result = sqlx::query("DELETE FROM tenants WHERE id = $1")
                .bind(test_tenant_id)
                .execute(&pool)
                .await?;
            
            println!("✅ Cleanup: {} rows deleted", delete_result.rows_affected());
        }
        Err(e) => {
            println!("❌ Insert failed: {}", e);
        }
    }

    println!("\n🎯 All database tests completed!");
    
    Ok(())
}
//! Finance data access — revenues, expenses, categories, aggregations.

use sqlx::SqlitePool;

use crate::core::time::now_iso;
use crate::finance::models::{Expense, ExpenseCategory, Revenue, RevenueCategory};

const REV_COLS: &str = "id, property_id, reservation_id, category_id, date, gross_amount, \
                        commission_amount, net_amount, source, currency, description, notes, \
                        deleted_at, is_deleted, created_at, updated_at, sync_id";
const EXP_COLS: &str = "id, property_id, category_id, date, amount, currency, vendor, \
                        payment_method, description, notes, is_recurring, receipt_url, \
                        deleted_at, is_deleted, created_at, updated_at, sync_id";
const CAT_COLS: &str = "id, name, description, is_default, sort_order, deleted_at, is_deleted, \
                        created_at, updated_at, sync_id";

// ── Revenues ────────────────────────────────────────────────

pub async fn insert_revenue(pool: &SqlitePool, r: &Revenue) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO revenues ({REV_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&r.id)
    .bind(&r.property_id)
    .bind(&r.reservation_id)
    .bind(&r.category_id)
    .bind(&r.date)
    .bind(r.gross_amount)
    .bind(r.commission_amount)
    .bind(r.net_amount)
    .bind(&r.source)
    .bind(&r.currency)
    .bind(&r.description)
    .bind(&r.notes)
    .bind(&r.deleted_at)
    .bind(r.is_deleted)
    .bind(&r.created_at)
    .bind(&r.updated_at)
    .bind(&r.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn get_revenue_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Revenue>, sqlx::Error> {
    sqlx::query_as::<_, Revenue>(&format!(
        "SELECT {REV_COLS} FROM revenues WHERE id = ? AND deleted_at IS NULL AND is_deleted = 0"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn list_revenues(
    pool: &SqlitePool,
    property_id: Option<&str>,
    category_id: Option<&str>,
    start: Option<&str>,
    end: Option<&str>,
    skip: i64,
    limit: i64,
) -> Result<Vec<Revenue>, sqlx::Error> {
    let mut sql =
        format!("SELECT {REV_COLS} FROM revenues WHERE deleted_at IS NULL AND is_deleted = 0");
    if property_id.is_some() {
        sql.push_str(" AND property_id = ?");
    }
    if category_id.is_some() {
        sql.push_str(" AND category_id = ?");
    }
    if start.is_some() {
        sql.push_str(" AND date >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND date <= ?");
    }
    sql.push_str(" ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, Revenue>(&sql);
    for v in [property_id, category_id, start, end].into_iter().flatten() {
        q = q.bind(v);
    }
    q.bind(limit).bind(skip).fetch_all(pool).await
}

pub async fn update_revenue(pool: &SqlitePool, r: &Revenue) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE revenues SET reservation_id=?, category_id=?, date=?, gross_amount=?, \
         commission_amount=?, net_amount=?, source=?, currency=?, description=?, notes=?, \
         updated_at=? WHERE id=?",
    )
    .bind(&r.reservation_id)
    .bind(&r.category_id)
    .bind(&r.date)
    .bind(r.gross_amount)
    .bind(r.commission_amount)
    .bind(r.net_amount)
    .bind(&r.source)
    .bind(&r.currency)
    .bind(&r.description)
    .bind(&r.notes)
    .bind(&r.updated_at)
    .bind(&r.id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn soft_delete_revenue(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
    let now = now_iso();
    let res = sqlx::query(
        "UPDATE revenues SET deleted_at = ?, is_deleted = 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

// ── Expenses ────────────────────────────────────────────────

pub async fn insert_expense(pool: &SqlitePool, e: &Expense) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO expenses ({EXP_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&e.id)
    .bind(&e.property_id)
    .bind(&e.category_id)
    .bind(&e.date)
    .bind(e.amount)
    .bind(&e.currency)
    .bind(&e.vendor)
    .bind(&e.payment_method)
    .bind(&e.description)
    .bind(&e.notes)
    .bind(e.is_recurring)
    .bind(&e.receipt_url)
    .bind(&e.deleted_at)
    .bind(e.is_deleted)
    .bind(&e.created_at)
    .bind(&e.updated_at)
    .bind(&e.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn get_expense_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Expense>, sqlx::Error> {
    sqlx::query_as::<_, Expense>(&format!(
        "SELECT {EXP_COLS} FROM expenses WHERE id = ? AND deleted_at IS NULL AND is_deleted = 0"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn list_expenses(
    pool: &SqlitePool,
    property_id: Option<&str>,
    category_id: Option<&str>,
    start: Option<&str>,
    end: Option<&str>,
    skip: i64,
    limit: i64,
) -> Result<Vec<Expense>, sqlx::Error> {
    let mut sql =
        format!("SELECT {EXP_COLS} FROM expenses WHERE deleted_at IS NULL AND is_deleted = 0");
    if property_id.is_some() {
        sql.push_str(" AND property_id = ?");
    }
    if category_id.is_some() {
        sql.push_str(" AND category_id = ?");
    }
    if start.is_some() {
        sql.push_str(" AND date >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND date <= ?");
    }
    sql.push_str(" ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, Expense>(&sql);
    for v in [property_id, category_id, start, end].into_iter().flatten() {
        q = q.bind(v);
    }
    q.bind(limit).bind(skip).fetch_all(pool).await
}

pub async fn update_expense(pool: &SqlitePool, e: &Expense) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE expenses SET category_id=?, date=?, amount=?, currency=?, vendor=?, \
         payment_method=?, description=?, notes=?, is_recurring=?, receipt_url=?, updated_at=? \
         WHERE id=?",
    )
    .bind(&e.category_id)
    .bind(&e.date)
    .bind(e.amount)
    .bind(&e.currency)
    .bind(&e.vendor)
    .bind(&e.payment_method)
    .bind(&e.description)
    .bind(&e.notes)
    .bind(e.is_recurring)
    .bind(&e.receipt_url)
    .bind(&e.updated_at)
    .bind(&e.id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn soft_delete_expense(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
    let now = now_iso();
    let res = sqlx::query(
        "UPDATE expenses SET deleted_at = ?, is_deleted = 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

// ── Categories (find-or-create, CRUD, merge) ────────────────

pub async fn find_or_create_revenue_category(
    pool: &SqlitePool,
    name: &str,
) -> Result<String, sqlx::Error> {
    let name = name.trim();
    if let Some(cat) = sqlx::query_as::<_, RevenueCategory>(&format!(
        "SELECT {CAT_COLS} FROM revenue_categories WHERE deleted_at IS NULL AND is_deleted = 0 \
         AND lower(name) = lower(?)"
    ))
    .bind(name)
    .fetch_optional(pool)
    .await?
    {
        return Ok(cat.id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO revenue_categories (id, name, description, is_default, sort_order, \
         deleted_at, is_deleted, created_at, updated_at, sync_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(name)
    .bind(None::<String>)
    .bind(false)
    .bind(0i64)
    .bind(None::<String>)
    .bind(false)
    .bind(&now)
    .bind(&now)
    .bind(None::<String>)
    .execute(pool)
    .await?;
    Ok(id)
}

pub async fn find_or_create_expense_category(
    pool: &SqlitePool,
    name: &str,
) -> Result<String, sqlx::Error> {
    let name = name.trim();
    if let Some(cat) = sqlx::query_as::<_, ExpenseCategory>(&format!(
        "SELECT {CAT_COLS} FROM expense_categories WHERE deleted_at IS NULL AND is_deleted = 0 \
         AND lower(name) = lower(?)"
    ))
    .bind(name)
    .fetch_optional(pool)
    .await?
    {
        return Ok(cat.id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();
    sqlx::query(
        "INSERT INTO expense_categories (id, name, description, is_default, sort_order, \
         deleted_at, is_deleted, created_at, updated_at, sync_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(&id)
    .bind(name)
    .bind(None::<String>)
    .bind(false)
    .bind(0i64)
    .bind(None::<String>)
    .bind(false)
    .bind(&now)
    .bind(&now)
    .bind(None::<String>)
    .execute(pool)
    .await?;
    Ok(id)
}

pub async fn get_revenue_category(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<RevenueCategory>, sqlx::Error> {
    sqlx::query_as::<_, RevenueCategory>(&format!(
        "SELECT {CAT_COLS} FROM revenue_categories WHERE id = ? AND deleted_at IS NULL AND is_deleted = 0"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_expense_category(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ExpenseCategory>, sqlx::Error> {
    sqlx::query_as::<_, ExpenseCategory>(&format!(
        "SELECT {CAT_COLS} FROM expense_categories WHERE id = ? AND deleted_at IS NULL AND is_deleted = 0"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_revenue_categories(
    pool: &SqlitePool,
) -> Result<Vec<RevenueCategory>, sqlx::Error> {
    sqlx::query_as::<_, RevenueCategory>(&format!(
        "SELECT {CAT_COLS} FROM revenue_categories WHERE deleted_at IS NULL AND is_deleted = 0 \
         ORDER BY sort_order, name"
    ))
    .fetch_all(pool)
    .await
}

pub async fn list_revenue_categories_with_counts(
    pool: &SqlitePool,
) -> Result<Vec<crate::finance::schemas::RevenueCategoryWithCount>, sqlx::Error> {
    sqlx::query_as::<_, crate::finance::schemas::RevenueCategoryWithCount>(
        "SELECT c.id, c.name, c.description, c.is_default, c.sort_order, c.deleted_at, \
         c.is_deleted, c.created_at, c.updated_at, c.sync_id, \
         (SELECT COUNT(*) FROM revenues r WHERE r.category_id = c.id AND r.deleted_at IS NULL \
          AND r.is_deleted = 0) AS revenue_count \
         FROM revenue_categories c WHERE c.deleted_at IS NULL AND c.is_deleted = 0 \
         ORDER BY c.sort_order, c.name",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_expense_categories_with_counts(
    pool: &SqlitePool,
) -> Result<Vec<crate::finance::schemas::ExpenseCategoryWithCount>, sqlx::Error> {
    sqlx::query_as::<_, crate::finance::schemas::ExpenseCategoryWithCount>(
        "SELECT c.id, c.name, c.description, c.is_default, c.sort_order, c.deleted_at, \
         c.is_deleted, c.created_at, c.updated_at, c.sync_id, \
         (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.deleted_at IS NULL \
          AND e.is_deleted = 0) AS expense_count \
         FROM expense_categories c WHERE c.deleted_at IS NULL AND c.is_deleted = 0 \
         ORDER BY c.sort_order, c.name",
    )
    .fetch_all(pool)
    .await
}

pub async fn insert_expense_category(
    pool: &SqlitePool,
    c: &ExpenseCategory,
) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO expense_categories ({CAT_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&c.id)
    .bind(&c.name)
    .bind(&c.description)
    .bind(c.is_default)
    .bind(c.sort_order)
    .bind(&c.deleted_at)
    .bind(c.is_deleted)
    .bind(&c.created_at)
    .bind(&c.updated_at)
    .bind(&c.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn update_expense_category(
    pool: &SqlitePool,
    c: &ExpenseCategory,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE expense_categories SET name = ?, description = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&c.name)
    .bind(&c.description)
    .bind(&c.updated_at)
    .bind(&c.id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn soft_delete_expense_category(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
    let now = now_iso();
    let res = sqlx::query(
        "UPDATE expense_categories SET deleted_at = ?, is_deleted = 1, updated_at = ? \
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

/// Reassign all expenses from `source_id` into `target_id`, then soft-delete
/// the source category. Returns the target category.
pub async fn merge_expense_category(
    pool: &SqlitePool,
    source_id: &str,
    target_id: &str,
) -> Result<Option<ExpenseCategory>, sqlx::Error> {
    sqlx::query("UPDATE expenses SET category_id = ? WHERE category_id = ?")
        .bind(target_id)
        .bind(source_id)
        .execute(pool)
        .await?;
    let now = now_iso();
    sqlx::query(
        "UPDATE expense_categories SET deleted_at = ?, is_deleted = 1, updated_at = ? WHERE id = ?",
    )
    .bind(&now)
    .bind(&now)
    .bind(source_id)
    .execute(pool)
    .await?;
    get_expense_category(pool, target_id).await
}

pub async fn insert_revenue_category(
    pool: &SqlitePool,
    c: &RevenueCategory,
) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO revenue_categories ({CAT_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ))
    .bind(&c.id)
    .bind(&c.name)
    .bind(&c.description)
    .bind(c.is_default)
    .bind(c.sort_order)
    .bind(&c.deleted_at)
    .bind(c.is_deleted)
    .bind(&c.created_at)
    .bind(&c.updated_at)
    .bind(&c.sync_id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn update_revenue_category(
    pool: &SqlitePool,
    c: &RevenueCategory,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE revenue_categories SET name = ?, description = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&c.name)
    .bind(&c.description)
    .bind(&c.updated_at)
    .bind(&c.id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn soft_delete_revenue_category(pool: &SqlitePool, id: &str) -> Result<u64, sqlx::Error> {
    let now = now_iso();
    let res = sqlx::query(
        "UPDATE revenue_categories SET deleted_at = ?, is_deleted = 1, updated_at = ? \
         WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(&now)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

// ── Aggregations (reports) ──────────────────────────────────

pub async fn sum_revenue(
    pool: &SqlitePool,
    start: Option<&str>,
    end: Option<&str>,
) -> Result<(f64, i64), sqlx::Error> {
    let mut sql = String::from(
        "SELECT COALESCE(SUM(net_amount), 0.0), COUNT(*) FROM revenues \
         WHERE deleted_at IS NULL AND is_deleted = 0",
    );
    if start.is_some() {
        sql.push_str(" AND date >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND date <= ?");
    }
    let mut q = sqlx::query_as::<_, (f64, i64)>(&sql);
    for v in [start, end].into_iter().flatten() {
        q = q.bind(v);
    }
    q.fetch_one(pool).await
}

/// Gross + net revenue and row count over a range.
pub async fn revenue_totals(
    pool: &SqlitePool,
    start: Option<&str>,
    end: Option<&str>,
) -> Result<(f64, f64, i64), sqlx::Error> {
    let mut sql = String::from(
        "SELECT COALESCE(SUM(gross_amount), 0.0), COALESCE(SUM(net_amount), 0.0), COUNT(*) \
         FROM revenues WHERE deleted_at IS NULL AND is_deleted = 0",
    );
    if start.is_some() {
        sql.push_str(" AND date >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND date <= ?");
    }
    let mut q = sqlx::query_as::<_, (f64, f64, i64)>(&sql);
    for v in [start, end].into_iter().flatten() {
        q = q.bind(v);
    }
    q.fetch_one(pool).await
}

pub async fn sum_expense(
    pool: &SqlitePool,
    start: Option<&str>,
    end: Option<&str>,
) -> Result<(f64, i64), sqlx::Error> {
    let mut sql = String::from(
        "SELECT COALESCE(SUM(amount), 0.0), COUNT(*) FROM expenses \
         WHERE deleted_at IS NULL AND is_deleted = 0",
    );
    if start.is_some() {
        sql.push_str(" AND date >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND date <= ?");
    }
    let mut q = sqlx::query_as::<_, (f64, i64)>(&sql);
    for v in [start, end].into_iter().flatten() {
        q = q.bind(v);
    }
    q.fetch_one(pool).await
}

pub async fn revenue_by_category(
    pool: &SqlitePool,
    start: &str,
    end: &str,
) -> Result<Vec<(String, f64, i64)>, sqlx::Error> {
    sqlx::query_as::<_, (String, f64, i64)>(
        "SELECT COALESCE(c.name, 'Uncategorized') AS category_name, \
                COALESCE(SUM(r.net_amount), 0.0) AS total, COUNT(*) AS count \
         FROM revenues r LEFT JOIN revenue_categories c ON c.id = r.category_id \
         WHERE r.deleted_at IS NULL AND r.is_deleted = 0 AND r.date >= ? AND r.date <= ? \
         GROUP BY r.category_id ORDER BY total DESC",
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await
}

pub async fn expenses_by_category(
    pool: &SqlitePool,
    start: &str,
    end: &str,
) -> Result<Vec<(String, f64, i64)>, sqlx::Error> {
    sqlx::query_as::<_, (String, f64, i64)>(
        "SELECT COALESCE(c.name, 'Uncategorized') AS category_name, \
                COALESCE(SUM(e.amount), 0.0) AS total, COUNT(*) AS count \
         FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id \
         WHERE e.deleted_at IS NULL AND e.is_deleted = 0 AND e.date >= ? AND e.date <= ? \
         GROUP BY e.category_id ORDER BY total DESC",
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await
}

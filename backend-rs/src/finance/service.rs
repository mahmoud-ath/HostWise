//! Finance business logic, mirroring `backend/app/finance/service.py`.
//! KPI calculations live here, never in the router.

use std::sync::Arc;

use chrono::NaiveDate;
use uuid::Uuid;

use crate::core::config::Config;
use crate::core::error::AppError;
use crate::core::state::AppState;
use crate::core::time::now_iso;
use crate::finance::models::{Expense, ExpenseCategory, Revenue, RevenueCategory};
use crate::finance::repository as repo;
use crate::finance::schemas::{
    AnnualReport, CategoryCreateRequest, CategoryUpdateRequest, ExpenseCategoryWithCount,
    ExpenseCreateRequest, ExpenseUpdateRequest, FinancialSummary, MonthlyReport,
    RevenueCreateRequest, RevenueUpdateRequest,
};

pub struct FinanceService {
    pub pool: sqlx::SqlitePool,
    pub config: Arc<Config>,
}

impl FinanceService {
    pub fn new(state: AppState) -> Self {
        Self {
            pool: state.pool,
            config: state.config,
        }
    }

    // ── Revenues ────────────────────────────────────────────

    pub async fn create_revenue(&self, req: RevenueCreateRequest) -> Result<Revenue, AppError> {
        // net = gross - commission (mirrors RevenueService.create).
        let net = req.gross_amount - req.commission_amount;
        let mut category_id = req.category_id;
        let desc = req.description.as_deref().unwrap_or("").trim().to_string();
        if category_id.is_none() && !desc.is_empty() {
            category_id = Some(repo::find_or_create_revenue_category(&self.pool, &desc).await?);
        }

        let now = now_iso();
        let revenue = Revenue {
            id: Uuid::new_v4().to_string(),
            property_id: req.property_id,
            reservation_id: req.reservation_id,
            category_id,
            date: req.date,
            gross_amount: req.gross_amount,
            commission_amount: req.commission_amount,
            net_amount: net,
            source: req.source,
            currency: req.currency,
            description: req.description,
            notes: req.notes,
            deleted_at: None,
            is_deleted: false,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        repo::insert_revenue(&self.pool, &revenue).await?;
        Ok(revenue)
    }

    pub async fn get_revenue(&self, id: &str) -> Result<Revenue, AppError> {
        repo::get_revenue_by_id(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn list_revenues(
        &self,
        property_id: Option<&str>,
        category_id: Option<&str>,
        start: Option<&str>,
        end: Option<&str>,
        skip: i64,
        limit: i64,
    ) -> Result<Vec<Revenue>, AppError> {
        Ok(repo::list_revenues(&self.pool, property_id, category_id, start, end, skip, limit).await?)
    }

    pub async fn update_revenue(
        &self,
        id: &str,
        req: RevenueUpdateRequest,
    ) -> Result<Revenue, AppError> {
        let mut r = repo::get_revenue_by_id(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)?;

        if let Some(v) = req.gross_amount {
            r.gross_amount = v;
            r.net_amount = r.gross_amount - r.commission_amount;
        }
        if let Some(v) = req.commission_amount {
            r.commission_amount = v;
            r.net_amount = r.gross_amount - r.commission_amount;
        }
        if let Some(v) = req.category_id {
            r.category_id = Some(v);
        }
        if let Some(v) = req.currency {
            r.currency = v;
        }
        if let Some(v) = req.description {
            let new_desc = v.trim().to_string();
            r.description = Some(v);
            // Re-categorize on description-only edits when no category is set.
            if r.category_id.is_none() && !new_desc.is_empty() {
                r.category_id = Some(repo::find_or_create_revenue_category(&self.pool, &new_desc).await?);
            }
        }
        if let Some(v) = req.notes {
            r.notes = Some(v);
        }
        r.updated_at = now_iso();

        repo::update_revenue(&self.pool, &r).await?;
        Ok(r)
    }

    pub async fn delete_revenue(&self, id: &str) -> Result<(), AppError> {
        let rows = repo::soft_delete_revenue(&self.pool, id).await?;
        if rows == 0 {
            return Err(AppError::NotFound);
        }
        Ok(())
    }

    // ── Expenses ────────────────────────────────────────────

    pub async fn create_expense(&self, req: ExpenseCreateRequest) -> Result<Expense, AppError> {
        let now = now_iso();
        let expense = Expense {
            id: Uuid::new_v4().to_string(),
            property_id: req.property_id,
            category_id: req.category_id,
            date: req.date,
            amount: req.amount,
            currency: req.currency,
            vendor: req.vendor,
            payment_method: req.payment_method,
            description: req.description,
            notes: req.notes,
            is_recurring: req.is_recurring,
            receipt_url: req.receipt_url,
            deleted_at: None,
            is_deleted: false,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        repo::insert_expense(&self.pool, &expense).await?;
        Ok(expense)
    }

    pub async fn get_expense(&self, id: &str) -> Result<Expense, AppError> {
        repo::get_expense_by_id(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn list_expenses(
        &self,
        property_id: Option<&str>,
        category_id: Option<&str>,
        start: Option<&str>,
        end: Option<&str>,
        skip: i64,
        limit: i64,
    ) -> Result<Vec<Expense>, AppError> {
        Ok(repo::list_expenses(&self.pool, property_id, category_id, start, end, skip, limit).await?)
    }

    pub async fn update_expense(
        &self,
        id: &str,
        req: ExpenseUpdateRequest,
    ) -> Result<Expense, AppError> {
        let mut e = repo::get_expense_by_id(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)?;

        if let Some(v) = req.category_id {
            e.category_id = Some(v);
        }
        if let Some(v) = req.amount {
            e.amount = v;
        }
        if let Some(v) = req.currency {
            e.currency = v;
        }
        if let Some(v) = req.vendor {
            e.vendor = Some(v);
        }
        if let Some(v) = req.payment_method {
            e.payment_method = Some(v);
        }
        if let Some(v) = req.description {
            e.description = Some(v);
        }
        if let Some(v) = req.notes {
            e.notes = Some(v);
        }
        if let Some(v) = req.is_recurring {
            e.is_recurring = v;
        }
        if let Some(v) = req.receipt_url {
            e.receipt_url = Some(v);
        }
        e.updated_at = now_iso();

        repo::update_expense(&self.pool, &e).await?;
        Ok(e)
    }

    pub async fn delete_expense(&self, id: &str) -> Result<(), AppError> {
        let rows = repo::soft_delete_expense(&self.pool, id).await?;
        if rows == 0 {
            return Err(AppError::NotFound);
        }
        Ok(())
    }

    // ── Expense categories ──────────────────────────────────

    pub async fn list_expense_categories(&self) -> Result<Vec<ExpenseCategoryWithCount>, AppError> {
        Ok(repo::list_expense_categories_with_counts(&self.pool).await?)
    }

    pub async fn create_expense_category(
        &self,
        req: CategoryCreateRequest,
    ) -> Result<ExpenseCategory, AppError> {
        let name = req.name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".into()));
        }
        let now = now_iso();
        let cat = ExpenseCategory {
            id: Uuid::new_v4().to_string(),
            name,
            description: req.description,
            is_default: false,
            sort_order: 0,
            deleted_at: None,
            is_deleted: false,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        repo::insert_expense_category(&self.pool, &cat).await?;
        Ok(cat)
    }

    pub async fn update_expense_category(
        &self,
        id: &str,
        req: CategoryUpdateRequest,
    ) -> Result<ExpenseCategory, AppError> {
        let mut c = repo::get_expense_category(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)?;
        if let Some(v) = req.name {
            let trimmed = v.trim().to_string();
            if !trimmed.is_empty() {
                c.name = trimmed;
            }
        }
        if let Some(v) = req.description {
            c.description = Some(v);
        }
        c.updated_at = now_iso();
        repo::update_expense_category(&self.pool, &c).await?;
        Ok(c)
    }

    pub async fn merge_expense_category(
        &self,
        source_id: &str,
        target_id: &str,
    ) -> Result<ExpenseCategory, AppError> {
        if source_id == target_id {
            return Err(AppError::Validation("cannot merge a category into itself".into()));
        }
        repo::merge_expense_category(&self.pool, source_id, target_id)
            .await?
            .ok_or(AppError::NotFound)
    }

    pub async fn delete_expense_category(&self, id: &str) -> Result<(), AppError> {
        let rows = repo::soft_delete_expense_category(&self.pool, id).await?;
        if rows == 0 {
            return Err(AppError::NotFound);
        }
        Ok(())
    }

    // ── Revenue categories ──────────────────────────────────

    pub async fn list_revenue_categories(&self) -> Result<Vec<RevenueCategory>, AppError> {
        Ok(repo::list_revenue_categories(&self.pool).await?)
    }

    pub async fn create_revenue_category(
        &self,
        req: CategoryCreateRequest,
    ) -> Result<RevenueCategory, AppError> {
        let name = req.name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::Validation("name is required".into()));
        }
        let now = now_iso();
        let cat = RevenueCategory {
            id: Uuid::new_v4().to_string(),
            name,
            description: req.description,
            is_default: false,
            sort_order: 0,
            deleted_at: None,
            is_deleted: false,
            created_at: now.clone(),
            updated_at: now,
            sync_id: None,
        };
        repo::insert_revenue_category(&self.pool, &cat).await?;
        Ok(cat)
    }

    pub async fn update_revenue_category(
        &self,
        id: &str,
        req: CategoryUpdateRequest,
    ) -> Result<RevenueCategory, AppError> {
        let mut c = repo::get_revenue_category(&self.pool, id)
            .await?
            .ok_or(AppError::NotFound)?;
        if let Some(v) = req.name {
            let trimmed = v.trim().to_string();
            if !trimmed.is_empty() {
                c.name = trimmed;
            }
        }
        if let Some(v) = req.description {
            c.description = Some(v);
        }
        c.updated_at = now_iso();
        repo::update_revenue_category(&self.pool, &c).await?;
        Ok(c)
    }

    pub async fn delete_revenue_category(&self, id: &str) -> Result<(), AppError> {
        let rows = repo::soft_delete_revenue_category(&self.pool, id).await?;
        if rows == 0 {
            return Err(AppError::NotFound);
        }
        Ok(())
    }

    // ── Reports ─────────────────────────────────────────────

    pub async fn get_summary(
        &self,
        start: Option<&str>,
        end: Option<&str>,
    ) -> Result<FinancialSummary, AppError> {
        let (rev, rev_count) = repo::sum_revenue(&self.pool, start, end).await?;
        let (exp, exp_count) = repo::sum_expense(&self.pool, start, end).await?;
        Ok(FinancialSummary {
            total_revenue: rev,
            total_expenses: exp,
            net_cashflow: rev - exp,
            revenue_count: rev_count,
            expense_count: exp_count,
        })
    }

    pub async fn get_monthly_report(&self, year: i32, month: u32) -> Result<MonthlyReport, AppError> {
        if !(1..=12).contains(&month) {
            return Err(AppError::Validation("month must be 1-12".into()));
        }
        let start = NaiveDate::from_ymd_opt(year, month, 1)
            .ok_or_else(|| AppError::Validation("invalid date".into()))?;
        let end = if month == 12 {
            NaiveDate::from_ymd_opt(year, 12, 31).unwrap()
        } else {
            NaiveDate::from_ymd_opt(year, month + 1, 1)
                .unwrap()
                .pred_opt()
                .unwrap()
        };
        let s = start.format("%Y-%m-%d").to_string();
        let e = end.format("%Y-%m-%d").to_string();

        let (rev, _) = repo::sum_revenue(&self.pool, Some(&s), Some(&e)).await?;
        let (exp, _) = repo::sum_expense(&self.pool, Some(&s), Some(&e)).await?;
        let revenue_by_category = repo::revenue_by_category(&self.pool, &s, &e).await?;
        let expenses_by_category = repo::expenses_by_category(&self.pool, &s, &e).await?;

        Ok(MonthlyReport {
            year,
            month: month as i32,
            total_revenue: rev,
            total_expenses: exp,
            net: rev - exp,
            revenue_by_category,
            expenses_by_category,
        })
    }

    pub async fn get_annual_report(&self, year: i32) -> Result<AnnualReport, AppError> {
        let mut months = Vec::with_capacity(12);
        let mut total_revenue = 0.0;
        let mut total_expenses = 0.0;
        for m in 1..=12u32 {
            let mr = self.get_monthly_report(year, m).await?;
            total_revenue += mr.total_revenue;
            total_expenses += mr.total_expenses;
            months.push(mr);
        }
        Ok(AnnualReport {
            year,
            months,
            total_revenue,
            total_expenses,
            net: total_revenue - total_expenses,
        })
    }
}

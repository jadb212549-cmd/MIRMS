use std::path::PathBuf;
use rusqlite::{params, Connection, Result};
use directories::ProjectDirs;
use crate::models::{MasterItem, ReferenceRegistration, AuditLogEntry, InitialStateResponse, FullBackupPayload};

pub fn get_app_data_dir() -> PathBuf {
    // Portable Mode: Always store data in "ReferenceTracker_Data" directly beside the executable
    let base_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| {
            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
        });

    let data_dir = base_dir.join("ReferenceTracker_Data");
    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::create_dir_all(data_dir.join("database"));
    let _ = std::fs::create_dir_all(data_dir.join("references").join("PHOTOS"));
    let _ = std::fs::create_dir_all(data_dir.join("references").join("ATTACHMENTS"));
    let _ = std::fs::create_dir_all(data_dir.join("references").join("FORMS"));
    let _ = std::fs::create_dir_all(data_dir.join("templates"));
    let _ = std::fs::create_dir_all(data_dir.join("backups"));
    data_dir
}

pub fn get_db_connection() -> Result<Connection> {
    let data_dir = get_app_data_dir();
    let db_path = data_dir.join("database").join("material_reference.db");
    let conn = Connection::open(db_path)?;
    init_tables(&conn)?;
    Ok(conn)
}

pub fn init_tables(conn: &Connection) -> Result<()> {
    // 1. Master Items (Zero Inventory columns strictly enforced!)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS master_items (
            id TEXT PRIMARY KEY,
            product_code TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            unit TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // 2. Reference Registrations (Product Code UNIQUE index)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS reference_registrations (
            id TEXT PRIMARY KEY,
            master_item_id TEXT NOT NULL,
            product_code TEXT UNIQUE NOT NULL,
            registration_date TEXT NOT NULL,
            registered_by TEXT NOT NULL,
            supplier TEXT,
            specification TEXT,
            remarks TEXT,
            revision TEXT NOT NULL,
            custom_fields_json TEXT NOT NULL,
            photos_json TEXT NOT NULL,
            attachments_json TEXT NOT NULL,
            word_form_generated INTEGER DEFAULT 0,
            word_form_last_generated_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;

    // 3. Audit Logs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            user TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            entity_identifier TEXT,
            details TEXT NOT NULL
        )",
        [],
    )?;

    // 4. App Config
    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

pub fn load_initial_state() -> Result<InitialStateResponse> {
    let conn = get_db_connection()?;

    let mut stmt_items = conn.prepare(
        "SELECT id, product_code, description, category, status, unit, created_at, updated_at FROM master_items ORDER BY created_at DESC"
    )?;
    let item_iter = stmt_items.query_map([], |row| {
        Ok(MasterItem {
            id: row.get(0)?,
            product_code: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            status: row.get(4)?,
            unit: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;

    let mut master_items = Vec::new();
    for item in item_iter {
        master_items.push(item?);
    }

    let mut stmt_refs = conn.prepare(
        "SELECT id, master_item_id, product_code, registration_date, registered_by, supplier, specification, remarks, revision, custom_fields_json, photos_json, attachments_json, word_form_generated, word_form_last_generated_at, created_at, updated_at FROM reference_registrations ORDER BY registration_date DESC"
    )?;

    let ref_iter = stmt_refs.query_map([], |row| {
        let custom_fields_str: String = row.get(9)?;
        let photos_str: String = row.get(10)?;
        let attachments_str: String = row.get(11)?;
        let word_gen: i32 = row.get(12).unwrap_or(0);

        Ok(ReferenceRegistration {
            id: row.get(0)?,
            master_item_id: row.get(1)?,
            product_code: row.get(2)?,
            registration_date: row.get(3)?,
            registered_by: row.get(4)?,
            supplier: row.get(5)?,
            specification: row.get(6)?,
            remarks: row.get(7)?,
            revision: row.get(8)?,
            custom_fields: serde_json::from_str(&custom_fields_str).unwrap_or(serde_json::json!({})),
            photos: serde_json::from_str(&photos_str).unwrap_or_default(),
            attachments: serde_json::from_str(&attachments_str).unwrap_or_default(),
            word_form_generated: Some(word_gen == 1),
            word_form_last_generated_at: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;

    let mut registrations = Vec::new();
    for r in ref_iter {
        registrations.push(r?);
    }

    let mut stmt_logs = conn.prepare(
        "SELECT id, timestamp, user, action, entity_type, entity_id, entity_identifier, details FROM audit_logs ORDER BY timestamp DESC LIMIT 200"
    )?;

    let log_iter = stmt_logs.query_map([], |row| {
        Ok(AuditLogEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            user: row.get(2)?,
            action: row.get(3)?,
            entity_type: row.get(4)?,
            entity_id: row.get(5)?,
            entity_identifier: row.get(6)?,
            details: row.get(7)?,
        })
    })?;

    let mut audit_logs = Vec::new();
    for log in log_iter {
        audit_logs.push(log?);
    }

    let mut stmt_cfg = conn.prepare("SELECT value_json FROM app_config WHERE key = 'main'")?;
    let config_val: Option<String> = stmt_cfg.query_row([], |row| row.get(0)).ok();
    let config = if let Some(cv) = config_val {
        serde_json::from_str(&cv).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({
            "appName": "Material Reference & Sample Tracking System",
            "companyName": "Precision Industrial Manufacturing Corp.",
            "dataDirectory": get_app_data_dir().to_string_lossy().to_string(),
            "defaultRegisteredBy": "QA Inspector",
            "portableMode": true
        })
    };

    Ok(InitialStateResponse {
        master_items,
        registrations,
        audit_logs,
        config,
    })
}

pub fn upsert_master_item(item: &MasterItem) -> Result<()> {
    let conn = get_db_connection()?;
    conn.execute(
        "INSERT INTO master_items (id, product_code, description, category, status, unit, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            product_code=excluded.product_code,
            description=excluded.description,
            category=excluded.category,
            status=excluded.status,
            unit=excluded.unit,
            updated_at=excluded.updated_at",
        params![
            item.id,
            item.product_code,
            item.description,
            item.category,
            item.status,
            item.unit,
            item.created_at,
            item.updated_at
        ],
    )?;
    Ok(())
}

pub fn delete_master_item(id: &str) -> Result<()> {
    let conn = get_db_connection()?;
    conn.execute("DELETE FROM master_items WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn bulk_upsert_master_items(items: &[MasterItem]) -> Result<()> {
    let mut conn = get_db_connection()?;
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO master_items (id, product_code, description, category, status, unit, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                product_code=excluded.product_code,
                description=excluded.description,
                category=excluded.category,
                status=excluded.status,
                unit=excluded.unit,
                updated_at=excluded.updated_at"
        )?;

        for item in items {
            stmt.execute(params![
                item.id,
                item.product_code,
                item.description,
                item.category,
                item.status,
                item.unit,
                item.created_at,
                item.updated_at
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn upsert_registration(reg: &ReferenceRegistration) -> Result<()> {
    let conn = get_db_connection()?;
    let custom_json = serde_json::to_string(&reg.custom_fields).unwrap_or("{}".to_string());
    let photos_json = serde_json::to_string(&reg.photos).unwrap_or("[]".to_string());
    let att_json = serde_json::to_string(&reg.attachments).unwrap_or("[]".to_string());
    let word_gen = if reg.word_form_generated.unwrap_or(false) { 1 } else { 0 };

    conn.execute(
        "INSERT INTO reference_registrations (
            id, master_item_id, product_code, registration_date, registered_by,
            supplier, specification, remarks, revision, custom_fields_json,
            photos_json, attachments_json, word_form_generated, word_form_last_generated_at,
            created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
            master_item_id=excluded.master_item_id,
            product_code=excluded.product_code,
            registration_date=excluded.registration_date,
            registered_by=excluded.registered_by,
            supplier=excluded.supplier,
            specification=excluded.specification,
            remarks=excluded.remarks,
            revision=excluded.revision,
            custom_fields_json=excluded.custom_fields_json,
            photos_json=excluded.photos_json,
            attachments_json=excluded.attachments_json,
            word_form_generated=excluded.word_form_generated,
            word_form_last_generated_at=excluded.word_form_last_generated_at,
            updated_at=excluded.updated_at",
        params![
            reg.id,
            reg.master_item_id,
            reg.product_code,
            reg.registration_date,
            reg.registered_by,
            reg.supplier,
            reg.specification,
            reg.remarks,
            reg.revision,
            custom_json,
            photos_json,
            att_json,
            word_gen,
            reg.word_form_last_generated_at,
            reg.created_at,
            reg.updated_at
        ],
    )?;
    Ok(())
}

pub fn delete_registration(id: &str) -> Result<()> {
    let conn = get_db_connection()?;
    conn.execute("DELETE FROM reference_registrations WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn save_config(config: &serde_json::Value) -> Result<()> {
    let conn = get_db_connection()?;
    let json_str = serde_json::to_string(config).unwrap_or("{}".to_string());
    conn.execute(
        "INSERT INTO app_config (key, value_json) VALUES ('main', ?1)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        params![json_str],
    )?;
    Ok(())
}

pub fn restore_backup(payload: &FullBackupPayload) -> Result<()> {
    let mut conn = get_db_connection()?;
    let tx = conn.transaction()?;

    tx.execute("DELETE FROM master_items", [])?;
    tx.execute("DELETE FROM reference_registrations", [])?;
    tx.execute("DELETE FROM audit_logs", [])?;

    {
        let mut stmt_items = tx.prepare(
            "INSERT INTO master_items (id, product_code, description, category, status, unit, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )?;
        for item in &payload.master_items {
            stmt_items.execute(params![
                item.id,
                item.product_code,
                item.description,
                item.category,
                item.status,
                item.unit,
                item.created_at,
                item.updated_at
            ])?;
        }

        let mut stmt_refs = tx.prepare(
            "INSERT INTO reference_registrations (
                id, master_item_id, product_code, registration_date, registered_by,
                supplier, specification, remarks, revision, custom_fields_json,
                photos_json, attachments_json, word_form_generated, word_form_last_generated_at,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)"
        )?;
        for reg in &payload.registrations {
            let custom_json = serde_json::to_string(&reg.custom_fields).unwrap_or("{}".to_string());
            let photos_json = serde_json::to_string(&reg.photos).unwrap_or("[]".to_string());
            let att_json = serde_json::to_string(&reg.attachments).unwrap_or("[]".to_string());
            let word_gen = if reg.word_form_generated.unwrap_or(false) { 1 } else { 0 };

            stmt_refs.execute(params![
                reg.id,
                reg.master_item_id,
                reg.product_code,
                reg.registration_date,
                reg.registered_by,
                reg.supplier,
                reg.specification,
                reg.remarks,
                reg.revision,
                custom_json,
                photos_json,
                att_json,
                word_gen,
                reg.word_form_last_generated_at,
                reg.created_at,
                reg.updated_at
            ])?;
        }

        let mut stmt_logs = tx.prepare(
            "INSERT INTO audit_logs (id, timestamp, user, action, entity_type, entity_id, entity_identifier, details)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )?;
        for log in &payload.audit_logs {
            stmt_logs.execute(params![
                log.id,
                log.timestamp,
                log.user,
                log.action,
                log.entity_type,
                log.entity_id,
                log.entity_identifier,
                log.details
            ])?;
        }
    }

    let config_json = serde_json::to_string(&payload.config).unwrap_or("{}".to_string());
    tx.execute(
        "INSERT INTO app_config (key, value_json) VALUES ('main', ?1)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        params![config_json],
    )?;

    tx.commit()?;
    Ok(())
}

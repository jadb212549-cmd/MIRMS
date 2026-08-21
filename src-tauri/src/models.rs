use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MasterItem {
    pub id: String,
    pub product_code: String,
    pub description: String,
    pub category: String, // "RM" | "PS"
    pub status: String,   // "Active" | "Inactive"
    pub unit: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoAttachment {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub data_url: String,
    pub caption: Option<String>,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAttachment {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub file_type: String,
    pub data_url: Option<String>,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceRegistration {
    pub id: String,
    pub master_item_id: String,
    pub product_code: String,
    pub registration_date: String,
    pub registered_by: String,
    pub supplier: Option<String>,
    pub specification: Option<String>,
    pub remarks: Option<String>,
    pub revision: String,
    #[serde(default)]
    pub custom_fields: serde_json::Value,
    #[serde(default)]
    pub photos: Vec<PhotoAttachment>,
    #[serde(default)]
    pub attachments: Vec<DocumentAttachment>,
    pub word_form_generated: Option<bool>,
    pub word_form_last_generated_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditLogEntry {
    pub id: String,
    pub timestamp: String,
    pub user: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub entity_identifier: Option<String>,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialStateResponse {
    pub master_items: Vec<MasterItem>,
    pub registrations: Vec<ReferenceRegistration>,
    pub audit_logs: Vec<AuditLogEntry>,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePayload {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullBackupPayload {
    pub master_items: Vec<MasterItem>,
    pub registrations: Vec<ReferenceRegistration>,
    pub audit_logs: Vec<AuditLogEntry>,
    pub config: serde_json::Value,
}

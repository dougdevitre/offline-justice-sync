# Data Model — Offline Justice Sync Engine

## Entity Relationship Diagram

```mermaid
erDiagram
    LOCAL_DOCUMENT {
        string id PK
        string collection
        json data
        string version "CRDT vector clock"
        boolean dirty "needs sync"
        boolean deleted "soft delete"
        datetime localUpdatedAt
        datetime remoteUpdatedAt
        string syncStatus "synced | pending | conflict"
    }

    OPERATION_QUEUE {
        string id PK
        string documentId FK
        string collection
        string type "put | delete | patch"
        json payload
        number retryCount
        datetime createdAt
        datetime scheduledAt
        string status "pending | processing | failed | synced"
    }

    SYNC_STATE {
        string id PK
        string collection
        string lastSyncCursor
        datetime lastSyncAt
        number pendingOperations
        number conflictCount
        string status "idle | syncing | error"
    }

    CONFLICT_RECORD {
        string id PK
        string documentId FK
        string collection
        json localVersion
        json remoteVersion
        json mergedVersion
        string resolution "auto | manual | pending"
        string strategy "lww | field_merge | custom"
        datetime detectedAt
        datetime resolvedAt
    }

    CONNECTION_LOG {
        string id PK
        string status "online | offline | degraded"
        number quality "0-100"
        number latencyMs
        number bandwidthKbps
        datetime timestamp
    }

    SMS_MESSAGE {
        string id PK
        string recipientPhone
        string content
        string type "deadline | hearing | critical"
        string twilioSid
        string deliveryStatus "queued | sent | delivered | failed"
        datetime sentAt
        datetime deliveredAt
    }

    LOCAL_DOCUMENT ||--o{ OPERATION_QUEUE : "has operations"
    LOCAL_DOCUMENT ||--o{ CONFLICT_RECORD : "has conflicts"
    SYNC_STATE ||--o{ LOCAL_DOCUMENT : "tracks collection"
```

## Key Entities

### LocalDocument
A document stored in the local-first database. Contains the data, version information (CRDT vector clock), sync status, and timestamps for both local and remote updates.

### OperationQueue
A queue of pending operations that need to be synced with the remote server. Operations are processed in order with retry logic and exponential backoff.

### SyncState
Tracks the synchronization state for each collection. Includes the last sync cursor, pending operation count, and current sync status.

### ConflictRecord
Records detected conflicts between local and remote versions of a document. Includes both versions, the merge strategy used, and resolution status.

### ConnectionLog
Historical record of connection quality measurements. Used for analytics and adaptive sync behavior.

### SMSMessage
Tracks SMS messages sent through the Twilio fallback. Includes delivery status tracking for critical alerts.

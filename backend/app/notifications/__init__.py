"""
Notifications Module

In-app notifications wired to the stored `notify_*` settings. The
`refresh()` action doubles as the lightweight scheduler tick for the
local-first desktop app: it recomputes the latest events and inserts
new notifications (deduplicated by fingerprint).
"""

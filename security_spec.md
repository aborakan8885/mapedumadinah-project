# Security Specification - Educational Map

## Data Invariants
- `FileMapping` documents must have a valid string `id`, `filename`, and `category`.
- The `files` collection stores both tabular school data and spatial boundary layers.

## The "Dirty Dozen" Payloads (Red Team Test Cases)
1. Create a file without an ID.
2. Update a file's `id` field (Immutable).
3. Update a file as an unauthenticated user.
4. Delete a file as an unauthenticated user.
5. Create a file with a non-string `filename`.
6. Inject a 2MB string into a small text field.
7. Attempt to set `category` to an invalid value.
8. Update `fileType` after creation (Immutable).
9. Create a file as a non-admin user.
10. Attempt to list all files without being signed in (Should be allowed if public view is intended, but we'll restrict write).
11. Attempt to bypass `isBoundaryLayer` type (should be boolean).
12. Inject shadow fields into a file document.

## Access Tiers
- **Tier 1 (Public)**: Can read all files to view the map.
- **Tier 2 (Admin - aborakan8885@gmail.com)**: Can create, update, and delete all files.

# Gmail Migration Guide (Google Takeout)

This project supports importing Gmail data through Google Takeout archives.

Use this guide after your server is already deployed and working.

## What This Imports

- Message bodies and metadata from Gmail MBOX exports
- Folders/labels mapping for mailbox organization
- Conversation history into the local database + IMAP sync flow

## 1. Export From Gmail

1. Go to Google Takeout.
2. Select Mail export.
3. Create and download the archive (`.tgz`).

If your export is split, keep all parts and import them one by one.

## 2. Upload The Takeout Archive

From your local machine:

```bash
./scripts/upload-takeout.sh --file /path/to/your-takeout.tgz
```

This uploads the archive to the server import directory.

If you want to upload and immediately start import:

```bash
./scripts/upload-takeout.sh --file /path/to/your-takeout.tgz --start-import
```

The script can read auth defaults from `config.env`, or you can pass host/email/password flags directly.

## 3. Start Import From Web UI (Alternative)

You can also start import from the web interface:

1. Open Settings.
2. Go to Import.
3. Select the uploaded archive / import source.
4. Start job and monitor progress.

## 4. Verify Result

After import:

1. Check mailbox/folder counts in webmail.
2. Spot-check recent, sent, and archived threads.
3. Confirm labels/categories expected from Gmail are present.

For large archives, first UI counts can take some time while background sync catches up.

## Notes

- Import is intended for migration/bootstrap, not continuous Gmail syncing.
- Keep a backup of your original Takeout files until you verify data integrity.

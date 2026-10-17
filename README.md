<div align="center">

# SHCloudPanel

**Your files. Your server.**
A private, encrypted, responsive cloud storage panel with light, dark and system themes.

![Version](https://img.shields.io/badge/version-1.3.1-4ade80?style=flat-square&labelColor=0a0a0a)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2024-4ade80?style=flat-square&labelColor=0a0a0a)
![Database](https://img.shields.io/badge/database-SQLite-fafaf9?style=flat-square&labelColor=0a0a0a)
![Port](https://img.shields.io/badge/port-6969-fafaf9?style=flat-square&labelColor=0a0a0a)
![License](https://img.shields.io/badge/license-MIT-fafaf9?style=flat-square&labelColor=0a0a0a)
[![Discord](https://img.shields.io/badge/discord-join-5865f2?style=flat-square&labelColor=0a0a0a)](https://dsc.gg/hozvikcloud)

</div>

---

`// overview`

SHCloudPanel runs on **Node.js 24+**, **SQLite** and **port 6969**, with **no third-party application dependencies**. Members get a private file space, admins manage members, and one protected owner controls the whole cloud.

> **Google login is a disabled "Coming soon" option.** Firebase/OAuth, email verification and emailed recovery are not configured. The operator resets forgotten passwords through the CLI.

## Features

`// features`

| Area | What you get |
| --- | --- |
| **Accounts** | Username or email + password login, registration, persistent sessions, password changes |
| **Roles** | One protected owner, administrators and members, enforced by the server |
| **Files** | File/folder uploads, drag and drop, nested folders, search, rename, move, favorites, image previews, downloads |
| **Uploads** | Unlimited per-file size by default (within quota and disk space), **20 MB parts** (owner-configurable **1-80 MB**), progress, retries, pause, cancel, resume |
| **Downloads** | Secure streaming with HTTP byte-range support, including older encrypted files |
| **Trash** | Restore, permanent deletion, storage accounting that includes trash |
| **Storage** | New members get **5 GB** by default, the owner gets **50 GB**; owner can change registration, quotas, branding, logo, favicon and accent color |
| **Security** | AES-256-GCM encrypted storage, scrypt passwords, hashed server-side sessions, HttpOnly cookies, origin/CSRF checks, request limits |
| **Interface** | Light/dark/system themes, animations, mobile layouts, reduced-motion support |
| **Operations** | Interactive installer, PM2 reboot startup, backups, account recovery, tested updater |

## Stack

`// stack`

- Node.js 24+ (ESM, no application dependencies)
- SQLite database
- PM2 (single fork process) for production
- Vanilla JavaScript frontend (`public/`), plain CSS with theme tokens

## Repository

`// repository`

| | |
| --- | --- |
| **GitHub** | [`its2jenil_`](https://github.com/its2jenil_) |
| **Repository** | [`its2jenil_/SHCloudPanel`](https://github.com/its2jenil_/SHCloudPanel) |
| **Branch** | `main` |

Keep `.env`, `data/`, `backups/` and credentials out of Git (already covered by `.gitignore`).

## Local development

`// local-development`

Install Node.js 24 or newer, then:

```sh
git clone --branch main https://github.com/its2jenil_/SHCloudPanel.git
cd SHCloudPanel
npm ci
cp .env.example .env
npm run setup
npm start
```

On PowerShell use `Copy-Item .env.example .env`.

Open **http://localhost:6969**, or **http://SERVER_IPV4:6969** using an IPv4 address assigned to the server. The app binds to `0.0.0.0:6969` and prints the available addresses at startup. Remote access needs your network/firewall to allow that port; the installer does not change firewall rules.

- Create the single owner account during terminal setup. There is **no default password** and no web owner-creation endpoint.
- Passwords must be 8-128 characters (eight digits are also accepted).
- `npm run dev` restarts the service when source files change.
- The service runs directly over HTTP. `APP_URL` is blank by default, so localhost and IP access work without hostname setup. Arbitrary DNS hostnames are rejected in this mode and authenticated-route CSRF protection stays on. `TRUST_PROXY` is `false` by default.

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `6969` | Service port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `production` | Runtime mode |
| `APP_URL` | *(blank)* | Blank accepts the current localhost/IP with the service port |
| `TRUST_PROXY` | `false` | Trust reverse-proxy headers |
| `COOKIE_SECURE` | `false` | Cookie mode (direct HTTP works without setup) |
| `DATA_DIR` | `./data` | SQLite, encrypted blobs and encryption key |
| `BACKUP_DIR` | `./backups` | Backup output |
| `REGISTRATION_DOMAIN` | *(blank)* | Optional: limit self-registration to one email domain |

## VPS installer

`// vps-installer`

**Supported:** Debian 12+ / Ubuntu 22.04+, x86_64 or ARM64, systemd, root/sudo access and enough disk for members' storage. Run the manager from **outside** the target project directory; it installs Git and clones the project itself.

```sh
curl -fsSL https://raw.githubusercontent.com/its2jenil_/SHCloudPanel/main/install.sh -o /root/shcloudpanel-manager.sh && bash /root/shcloudpanel-manager.sh
```

Choose **1** for a new installation or **9** to repair an existing one. Preview without installing: `bash /root/shcloudpanel-manager.sh --dry-run`.

> Use the **raw.githubusercontent.com** link above. A GitHub `/blob/` link returns an HTML page, and passing it to Bash causes errors like `<!DOCTYPE html>` or `syntax error near unexpected token`. Do not clone a setup checkout into `/root/shcloudpanel` first; that directory is the managed install target.

**What the installer does**

- Clones into `/root/shcloudpanel` and installs requirements with `npm ci`.
- Asks for owner details privately and starts the cloud on **6969**.
- Keeps an existing working Node.js 24+; otherwise installs the latest supported LTS with verified SHA-256 downloads.
- Installs PM2 with `npm install -g pm2`; source, backups, PM2 process and reboot startup all use the **root** account and `/root/.pm2`.
- `.env` is mode 600; the project and stored data are private to root.
- Package/Git diagnostics go to `/var/log/shcloudpanel-install.log` (owner passwords are never logged).
- "Installation complete" only appears after startup and the expected health/version check succeed.

**Manager menu:** Restart cloud (primary), optional Stop, status, update, password reset, backup, preview, **Repair / migrate (9)** and **Uninstall (10)**. Use `NO_COLOR=1` for plain output.

**Day-to-day PM2 commands**

```sh
sudo -i
cd /root/shcloudpanel
pm2 restart shcloudpanel --update-env
pm2 status
pm2 logs shcloudpanel --lines 50
```

## Update

`// update`

```sh
sudo bash /root/shcloudpanel/update.sh
```

The updater stops PM2, saves a consistent database/blob/key backup and a restricted copy of `.env`, fast-forwards the source, installs requirements, runs checks and tests, restarts and checks health. User data, quotas and branding are kept.

- Tracked local changes or divergent Git history stop the update. A failure restores tracked source and the previous environment.
- Source rollback does **not** restore the database. Keep the full pre-update backup.
- Before downgrading to v1.0, restore its matching complete backup (it cannot read segmented files).
- Use **one** PM2 fork process: per-account upload locking assumes a single instance.
- Upgrading an old `/opt` install or fixing permission errors: run **Repair / migrate (9)** once.

## Repair

`// repair`

For an older or interrupted installation, download the latest manager outside the project and choose **9**:

```sh
sudo -i
curl -fL https://raw.githubusercontent.com/its2jenil_/SHCloudPanel/main/install.sh -o /root/shcloudpanel-manager.sh
bash /root/shcloudpanel-manager.sh
```

Repair fetches the current source before stopping the cloud, makes a consistent private backup, migrates `/opt/shcloudpanel` to `/root/shcloudpanel`, fixes ownership, configures direct port 6969, preserves owner/files/key and restores PM2 startup. Tracked edits, divergent commits, two install directories, missing encryption keys and storage outside the managed directory are refused for manual recovery.

## Uninstall

`// uninstall`

Run the latest manager and choose **10**:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/its2jenil_/SHCloudPanel/main/install.sh)
```

Answer **Y** to delete or **N/Enter** to cancel.

> **Warning:** uninstall deletes the complete current and old project directories, including accounts, uploads, encryption key, environment and backups inside them. Copy a backup outside the project first if you want to keep it.

Global Node.js/PM2 and other applications stay installed. Repeating uninstall is safe, and the menu stays open so you can choose **1** for a fresh installation with a new owner and key.

## Roles and quotas

`// roles`

| Action | Owner | Admin | Member |
| --- | :---: | :---: | :---: |
| Manage own private files | Yes | Yes | Yes |
| Create/manage members and their quotas | Yes | Yes | No |
| Appoint/manage administrators | Yes | No | No |
| Create a second owner or delete the owner | No | No | No |
| Change branding, registration or upload settings | Yes | No | No |
| View audit events | Yes | No | No |
| Read another account's files in the panel | No | No | No |

Registration creates members. Account suspension and permission changes revoke sessions.

## Uploads and downloads

`// transfers`

- **File size** and **part size** are separate settings. File-size limit `0` means unlimited, but account quota, disk capacity and the free-space margin still apply.
- Default part size is **20 MB** (20 x 1,024^2 bytes), not a bandwidth cap. Change it in **Cloud settings -> Upload part size (MB)** (1-80). Changes affect new transfers only.
- **Pause** keeps committed parts for up to 24 hours. To resume after a reload, pick the original unchanged file again and choose Resume. **Cancel** removes unfinished parts and releases the reservation.
- Browser storage holds only resume metadata, never file contents or passwords.
- Downloads stream to the browser and support byte ranges. New files authenticate only the requested encrypted parts; legacy files authenticate their whole ciphertext first, which can add startup latency.

## Backups and account recovery

`// backups`

Use installer menu option **7**, or stop the service and run:

```sh
pm2 stop shcloudpanel
node --env-file-if-exists=.env src/cli.mjs backup
pm2 restart shcloudpanel
```

Backups contain SQLite, encrypted blobs (including committed upload parts) and the encryption key. Copy them to a protected off-server location. Restore the database, `blobs/` and `encryption.key` together into a fresh private data directory, and keep `.env` separately.

> **Losing the encryption key makes stored files unreadable.** The app refuses to create a replacement key for an existing database.

Recover an account with installer menu option **6**, or:

```sh
node --env-file-if-exists=.env src/cli.mjs reset-password
```

Recovery revokes existing sessions. Automation can pass JSON on stdin with `--stdin`; never put passwords in command arguments or committed files.

## Project structure

`// structure`

```
.
├── src/
│   ├── server.mjs        HTTP server and API routes
│   ├── transfers.mjs     Chunked uploads, resume, range downloads
│   ├── database.mjs      SQLite access
│   ├── security.mjs      Sessions, passwords, CSRF, rate limits
│   ├── config.mjs        Environment configuration
│   ├── lock.mjs          Single-instance / account locking
│   └── cli.mjs           setup, backup, reset-password
├── public/               Frontend (app.js, styles.css, theme.js, index.html)
├── scripts/check.mjs     Syntax / sanity checks
├── tests/                Application, transfer, runtime, installer, password tests
├── install.sh            VPS manager (install, repair, uninstall, backup)
├── update.sh             Managed updater
├── ecosystem.config.cjs  PM2 process definition
├── .env.example          Environment template
├── RELEASE-NOTES.md      Version history and upgrade notes
└── VALIDATION.md         Completed checks and deployment limits
```

## API at a glance

`// api`

| Group | Routes |
| --- | --- |
| **Public** | `GET /api/health`, `GET /api/config`, `POST /api/auth/login`, `POST /api/auth/register` |
| **Account** | `GET /api/me`, `PATCH /api/account`, `POST /api/auth/logout` |
| **Files** | `GET /api/entries`, `POST /api/folders`, `POST /api/uploads` (+ part, complete, cancel), `POST /api/upload`, file actions (rename, move, favorite, trash, restore, purge), `DELETE /api/trash` |
| **Admin** | `GET/POST /api/admin/users`, `PATCH/DELETE` per user, `PATCH /api/admin/settings`, `GET /api/admin/overview`, `GET /api/admin/audit` |

## Checks and tests

`// validation`

```sh
npm run check
npm test
```

See [VALIDATION.md](VALIDATION.md) for the completed checks and deployment limitations, and [RELEASE-NOTES.md](RELEASE-NOTES.md) for upgrade requirements.

## Storage boundaries and limits

`// limits`

- Files of any extension are private downloads; they are never executed or unzipped. Only signature-recognized raster images get inline previews; everything else is an attachment with `nosniff`.
- Keep the data directory outside any static web root.
- Trash counts toward quota. Pending transfers reserve quota/disk and release it on cancellation or expiry.
- Encryption is **server-side** storage encryption: anyone controlling the host and its key can decrypt files.
- This release is **not independently security audited or load tested**. MFA, virus scanning, distributed storage, public sharing, SMTP verification and email recovery are not implemented.
- Listings are limited to 2,000 items per view (use search for larger folders). Storage labels use binary units (1 GB = 1,024^3 bytes). The audit log keeps the latest 10,000 events; the owner sees the latest 200.

## Branding

`// branding`

The panel's default accent is `#7367f0`. The owner can change the accent color, brand name, logo and favicon from **Cloud settings**, so the panel can match the SHCloudPanel look without code changes. Light, dark and system themes are built in.

## Community

`// community`

Join the official Discord for help, updates and announcements: **https://dsc.gg/hozvikcloud**

## Credits and license

`// license`

This panel is based on an open-source project by [JishnuTheGamer](https://github.com/JishnuTheGamer/jtg-cloud) and is released under the **MIT License**. The original copyright notice is kept in [LICENSE](LICENSE).

Maintained by [**its2jenil_**](https://github.com/its2jenil_).

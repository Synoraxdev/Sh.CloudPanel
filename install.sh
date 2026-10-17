#!/usr/bin/env bash
# SHCloudPanel installation and management by its2jenil_.
set -Eeuo pipefail
umask 077
APP_DIR=/root/shcloudpanel
LEGACY_DIR=/opt/shcloudpanel
LEGACY_HOME=/home/shcloudpanel
LEGACY_RUNTIME=/opt/shcloudpanel-runtime
MANAGER_FILE=/root/shcloudpanel-manager.sh
NGINX_CONF=/etc/nginx/conf.d/shcloudpanel.conf
ACME_ROOT=/var/www/shcloudpanel-acme
STEP_TOTAL=10
INSTALL_METHOD=tunnel
DNS_DOMAIN=''
DNS_EMAIL=''
REPO_URL=https://github.com/Synoraxdev/Sh.CloudPanel.git
REPO_BRANCH=main
SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" && pwd -P)
LOG_FILE=/var/log/shcloudpanel-install.log
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export PM2_HOME=/root/.pm2
BOLD='' RESET='' ACCENT='' GREEN='' RED=''
if [[ -z "${NO_COLOR+x}" && "${TERM:-dumb}" != dumb ]] && [[ -t 1 || "${FORCE_COLOR:-0}" == 1 ]]; then
  BOLD=$'\033[1m'; RESET=$'\033[0m'; ACCENT=$'\033[36m'; GREEN=$'\033[32m'; RED=$'\033[31m'
fi
heading() { printf '\n%s%s%s%s\n' "$BOLD" "$ACCENT" "$*" "$RESET"; }
note() { printf '  %s\n' "$*"; }
success() { printf '  %sOK%s  %s\n' "$GREEN" "$RESET" "$*"; }
die() { printf '\n%s%sERROR%s  %s\n' "$BOLD" "$RED" "$RESET" "$*" >&2; exit 1; }
step() { printf '\n%s%s[%02d/%s] %s%s\n' "$BOLD" "$ACCENT" "$1" "$STEP_TOTAL" "$2" "$RESET"; }
require_root() { [[ $EUID -eq 0 ]] || die 'Run as root: sudo bash install.sh'; }
run_command() {
  if "$@" >>"$LOG_FILE" 2>&1; then return 0; fi
  printf '\nCommand failed. Recent diagnostic output:\n' >&2
  tail -n 15 "$LOG_FILE" >&2
  return 1
}
install_error() {
  local status=$1 line=$2
  trap - ERR
  printf '\nOperation stopped at line %s. Log: %s\nYour files and owner account are preserved. Fix the reported error and choose Repair / migrate installation to retry.\n' "$line" "$LOG_FILE" >&2
  exit "$status"
}
open_log() {
  [[ ! -L "$LOG_FILE" ]] || die 'The installer log must not be a symbolic link.'
  touch "$LOG_FILE"; chmod 600 "$LOG_FILE"
  printf '\nits2jenil_ / %s\n' "$(date -u +%FT%TZ)" >>"$LOG_FILE"
  trap 'install_error "$?" "$LINENO"' ERR
}
banner() {
  printf '\n%s%s  +----------------------------------------------------+\n' "$BOLD" "$ACCENT"
  printf '  |                    SHCLOUDPANEL                    |\n'
  printf '  |          Your files. Your server. Your control.    |\n'
  printf '  +----------------------------------------------------+%s\n' "$RESET"
  printf '  %sits2jenil_%s  /  VPS CONTROL CENTER\n\n' "$BOLD" "$RESET"
  note "Repository  $REPO_URL"
  note "Branch      $REPO_BRANCH"
  note "Directory   $APP_DIR"
  note "Discord     https://dsc.gg/hozvikcloud"
  note 'App port    6969'
  note 'PM2         Global install / root account'
  if [[ -f "$APP_DIR/.shcloudpanel-installed" ]]; then success 'Installation complete / use Service status to check PM2';
  elif [[ -d "$APP_DIR" || -d "$LEGACY_DIR" ]]; then note 'Status      Existing installation found; choose Repair / migrate';
  else note 'Status      Ready for a new installation'; fi
}
installation_plan() {
  heading 'INSTALLATION PLAN'
  note "git clone --branch $REPO_BRANCH $REPO_URL $APP_DIR"
  note "cd $APP_DIR"
  step 1 'Install Linux requirements'; note 'Git, curl, CA certificates, Python and xz tools.'
  step 2 'Install Node.js LTS and global PM2'; note 'Node.js 24+; npm install -g pm2'
  step 3 'Clone SHCloudPanel and enter the project directory'
  step 4 'Install locked application requirements'; note 'npm ci --omit=dev --ignore-scripts'
  step 5 'Configure private storage'; note 'Root owns and runs the cloud; .env and storage stay private.'
  step 6 'Create the owner account'; note 'Username, email and a password entered privately.'
  step 7 'Show service addresses'; note 'Localhost and IPv4 addresses already assigned to the server.'
  step 8 'Start SHCloudPanel with PM2'; note 'pm2 start ecosystem.config.cjs --only shcloudpanel'
  step 9 'Enable automatic startup after reboot'; note 'pm2 startup systemd -u root --hp /root; pm2 save'
  step 10 'Verify cloud health'; note 'Open http://localhost:6969 or http://SERVER_IPV4:6969 and sign in.'
  note 'The plan above is the "Via tunneling" method (direct server address, port 6969).'
  dns_installation_plan
}
dns_installation_plan() {
  local previous=$STEP_TOTAL
  STEP_TOTAL=13
  heading 'INSTALLATION PLAN - VIA DNS (NORMAL METHOD, RECOMMENDED)'
  note 'You enter a domain (cloud.example.com) whose A record points to this server; Cloudflare or any DNS provider works.'
  step 1 'Install Linux requirements, nginx and certbot'
  step 2 'Install Node.js LTS and global PM2'
  step 3 'Clone SHCloudPanel and enter the project directory'
  step 4 'Install locked application requirements'; note 'npm ci --omit=dev --ignore-scripts'
  step 5 'Configure private storage'; note 'The service listens on 127.0.0.1:6969 only; APP_URL=https://your-domain.'
  step 6 'Create the owner account'; note 'Username, email and a password entered privately.'
  step 7 'Start SHCloudPanel with PM2'; note 'pm2 start ecosystem.config.cjs --only shcloudpanel'
  step 8 'Enable automatic startup after reboot'; note 'pm2 startup systemd -u root --hp /root; pm2 save'
  step 9 'Verify local cloud health'
  step 10 'Create the nginx site for the domain'; note '/etc/nginx/conf.d/shcloudpanel.conf (other nginx sites are not touched).'
  step 11 'Issue the free SSL certificate'; note "certbot certonly --webroot (Let's Encrypt, renews automatically)."
  step 12 'Enable HTTPS and forward to SHCloudPanel'; note 'nginx terminates HTTPS and proxies to 127.0.0.1:6969.'
  step 13 'Verify https://your-domain'; note 'Open https://your-domain and sign in.'
  STEP_TOTAL=$previous
}
linux_requirements() {
  [[ -f /etc/os-release ]] || die 'Linux OS metadata is missing.'
  . /etc/os-release
  case "$ID" in ubuntu|debian) ;; *) die 'Use Debian 12+ or Ubuntu 22.04+.';; esac
  case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) die 'Only x86_64 and ARM64 are supported.';; esac
  command -v systemctl >/dev/null || die 'A systemd-based VPS is required.'
  run_command apt-get update
  run_command apt-get install -y ca-certificates curl git xz-utils python3
}
install_node() {
  local arch version filename temp expected destination executable
  # Keep a supported system Node; the old private runtime is not reused.
  if command -v node >/dev/null && command -v npm >/dev/null && [[ "$(command -v node)" != /opt/shcloudpanel-runtime/* ]] && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' && npm --version >/dev/null 2>&1; then
    success "Using Node.js $(node --version)"
    return 0
  fi
  case "$(uname -m)" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) die 'Unsupported CPU architecture.';; esac
  temp=$(mktemp -d)
  curl --fail --silent --show-error --location https://nodejs.org/dist/index.json -o "$temp/index.json"
  version=$(python3 - "$temp/index.json" <<'PY'
import json, sys
for item in json.load(open(sys.argv[1])):
    if item.get('lts') and int(item['version'].split('.')[0][1:]) >= 24:
        print(item['version']); break
else: raise SystemExit('No supported Node.js LTS found')
PY
)
  [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die 'Invalid Node.js release response.'
  filename="node-$version-linux-$arch.tar.xz"
  note "Installing Node.js LTS $version"
  curl --fail --silent --show-error --location "https://nodejs.org/dist/$version/$filename" -o "$temp/$filename"
  curl --fail --silent --show-error --location "https://nodejs.org/dist/$version/SHASUMS256.txt" -o "$temp/SHASUMS256.txt"
  expected=$(awk -v file="$filename" '$2==file {print $1}' "$temp/SHASUMS256.txt")
  [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || die 'Missing Node.js checksum.'
  printf '%s  %s\n' "$expected" "$temp/$filename" | sha256sum --check --status || die 'Node.js checksum did not match.'
  destination="/usr/local/lib/nodejs/node-$version-linux-$arch"
  [[ ! -L /usr/local/lib/nodejs && ! -L "$destination" ]] || die 'Node installation directory must not be a symbolic link.'
  mkdir -p /usr/local/lib/nodejs
  if [[ ! -d "$destination" ]]; then (umask 022; tar -xJf "$temp/$filename" -C /usr/local/lib/nodejs); fi
  chmod 755 /usr/local/lib/nodejs
  for executable in node npm npx; do ln -sfn "$destination/bin/$executable" "/usr/local/bin/$executable"; done
  hash -r
  rm -f -- "$temp/$filename" "$temp/SHASUMS256.txt" "$temp/index.json"; rmdir -- "$temp"
  node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'
  success "Node.js $(node --version) is available globally"
}
install_pm2() {
  # The normal global npm location; no application-specific PM2 binary or daemon.
  (umask 022; export NPM_CONFIG_PREFIX=/usr/local; run_command npm install -g pm2)
  hash -r
  command -v pm2 >/dev/null || die 'Global PM2 is missing after npm installation.'
  success "Global PM2 ready: $(command -v pm2)"
}
clone_project() {
  local source_remote=''
  if [[ -d "$SOURCE_DIR/.git" || -f "$SOURCE_DIR/.git" ]]; then
    source_remote=$(git -c safe.directory="$SOURCE_DIR" -C "$SOURCE_DIR" remote get-url origin 2>/dev/null) || source_remote=''
  fi
  case "$source_remote" in
    "$REPO_URL"|"${REPO_URL%.git}"|git@github.com:Synoraxdev/Sh.CloudPanel.git)
      note 'Using the local checkout (committed source only).'
      run_command git -c safe.directory="$SOURCE_DIR" clone --no-hardlinks --branch "$REPO_BRANCH" -- "$SOURCE_DIR" "$APP_DIR" || return 1;;
    *)
      note "Cloning $REPO_URL"
      run_command git clone --branch "$REPO_BRANCH" -- "$REPO_URL" "$APP_DIR" || { printf 'Repository download failed. Check the installer log and network access.\n' >&2; return 1; };;
  esac
  git -C "$APP_DIR" remote set-url origin "$REPO_URL" || return 1
  [[ -f "$APP_DIR/src/server.mjs" && -f "$APP_DIR/package.json" ]] || return 1
  cd "$APP_DIR" || return 1
  node -e "if(require('./package.json').name!=='shcloudpanel')process.exit(1)" || return 1
  success "Source ready in $APP_DIR"
}
validate_directory() {
  local directory=$1 resolved
  case "$directory" in /root/shcloudpanel|/opt/shcloudpanel) ;; *) die 'Refusing an unexpected installation path.';; esac
  [[ -d "$directory" && ! -L "$directory" ]] || die 'The installation must be a real directory, not a symbolic link.'
  resolved=$(realpath -e -- "$directory")
  [[ "$resolved" == "$directory" ]] || die 'The resolved installation path is unsafe.'
  [[ -d "$directory/.git" && -f "$directory/src/server.mjs" && -f "$directory/package.json" ]] || die 'This directory is not a managed SHCloudPanel checkout.'
  [[ ! -L "$directory/.git" && "$(realpath -e -- "$directory/package.json")" == "$directory/package.json" && "$(realpath -e -- "$directory/src/server.mjs")" == "$directory/src/server.mjs" ]] || die 'Managed source files must not redirect through symbolic links.'
  if [[ -e "$directory/.env" || -L "$directory/.env" ]]; then
    [[ ! -L "$directory/.env" && "$(realpath -e -- "$directory/.env")" == "$directory/.env" ]] || die 'The managed environment must not be a symbolic link.'
  fi
  node -e "if(require(process.argv[1]).name!=='shcloudpanel')process.exit(1)" "$directory/package.json" || die 'Unexpected application in the installation directory.'
}
validate_storage() {
  [[ -f .env ]] || return 0
  node --env-file=.env --input-type=module - "$PWD" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
const root = fs.realpathSync(process.argv[2]);
const inside = value => { const relative=path.relative(root,value); return relative && !relative.startsWith(`..${path.sep}`) && relative!=='..' && !path.isAbsolute(relative); };
const directories=[];
for (const key of ['DATA_DIR','BACKUP_DIR']) {
  const directory=path.resolve(root,process.env[key] || (key==='DATA_DIR'?'data':'backups'));
  let existing=directory;
  while(!fs.existsSync(existing)) existing=path.dirname(existing);
  const resolved=path.resolve(fs.realpathSync(existing),path.relative(existing,directory));
  if(!inside(directory)||!inside(resolved)) throw new Error(`${key} must stay inside the installation for managed migration/uninstall. Move external storage manually first.`);
  directories.push(resolved);
}
const nested=(a,b)=>{const relative=path.relative(a,b);return !relative || (relative!=='..'&&!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative));};
if(nested(directories[0],directories[1])||nested(directories[1],directories[0])) throw new Error('Data and backup directories must not overlap.');
JS
}
ensure_env_file() {
  [[ -f .env ]] && return 0
  if [[ -f .env.example ]]; then cp -- .env.example .env; return 0; fi
  # GitHub web uploads often skip dot-files, so fall back to the built-in defaults.
  note '.env.example is missing in the repository; creating .env from built-in defaults.'
  cat > .env <<'ENV'
# Node.js 24+; the Linux installer configures these values.
PORT=6969
HOST=0.0.0.0
NODE_ENV=production
# Blank accepts the current localhost/IP address with the service port.
APP_URL=
TRUST_PROXY=false
# Blank selects the cookie mode from APP_URL; direct HTTP works without setup.
COOKIE_SECURE=false
SHCLOUDPANEL_NETWORK_MODE=direct-v1
DATA_DIR=./data
BACKUP_DIR=./backups
# Optional: restrict self-registration to an email domain (example.com).
REGISTRATION_DOMAIN=
ENV
}
protect_private_files() {
  # If .gitignore is missing from the repo, keep secrets/data out of Git locally.
  [[ -d .git ]] || return 0
  mkdir -p .git/info
  local entry
  for entry in .env data/ backups/ node_modules/ .shcloudpanel-installed '*.log' .preview/; do
    grep -qxF -- "$entry" .git/info/exclude 2>/dev/null || printf '%s\n' "$entry" >> .git/info/exclude
  done
}
configure_environment() {
  ensure_env_file
  SHCP_METHOD="$INSTALL_METHOD" SHCP_DOMAIN="$DNS_DOMAIN" SHCP_EMAIL="$DNS_EMAIL" node --input-type=module - "${1:-$APP_DIR}" "$APP_DIR" <<'JS'
import fs from 'node:fs';
const [oldRoot,newRoot]=process.argv.slice(2);
let text=fs.readFileSync('.env','utf8').replaceAll('\r\n','\n');
// Preserve credentials/custom settings, and rewrite an absolute managed storage path when moving.
if(oldRoot!==newRoot) text=text.replace(/^(DATA_DIR|BACKUP_DIR)=(.*)$/gm,(line,key,value)=>{
  const quote=/^["']/.test(value)?value[0]:'';
  const bare=quote?value.slice(1,-1):value;
  return bare===oldRoot||bare.startsWith(`${oldRoot}/`)?`${key}=${quote}${newRoot}${bare.slice(oldRoot.length)}${quote}`:line;
});
// Tunneling (direct IP:6969) is the default; a DNS install is applied once and then preserved by Repair.
const dns=process.env.SHCP_METHOD==='dns'||/^SHCLOUDPANEL_NETWORK_MODE=dns-v1\s*$/m.test(text);
const existingUrl=(text.match(/^APP_URL=(.*)$/m)||[])[1]||'';
const values=dns
  ?{PORT:'6969',HOST:'127.0.0.1',NODE_ENV:'production',APP_URL:process.env.SHCP_DOMAIN?`https://${process.env.SHCP_DOMAIN}`:existingUrl,TRUST_PROXY:'true',COOKIE_SECURE:'true',SHCLOUDPANEL_NETWORK_MODE:'dns-v1',...(process.env.SHCP_EMAIL?{LETSENCRYPT_EMAIL:process.env.SHCP_EMAIL}:{})}
  :{PORT:'6969',HOST:'0.0.0.0',NODE_ENV:'production',APP_URL:'',TRUST_PROXY:'false',COOKIE_SECURE:'false',SHCLOUDPANEL_NETWORK_MODE:'direct-v1'};
for(const [key,value] of Object.entries(values)) {
  const expression=new RegExp(`^${key}=.*$`,'gm');
  text=expression.test(text)?text.replace(expression,`${key}=${value}`):`${text.trimEnd()}\n${key}=${value}\n`;
}
fs.writeFileSync('.env',text,{mode:0o600});
JS
}
private_permissions() {
  chown -R root:root "$APP_DIR"
  chmod -R go-rwx "$APP_DIR"
  chmod 700 "$APP_DIR"
  chmod 600 "$APP_DIR/.env"
}
process_state() {
  local home=$1
  PM2_HOME="$home" pm2 ping >/dev/null
  PM2_HOME="$home" pm2 jlist | node --input-type=module -e '
    import fs from "node:fs";
    const apps=JSON.parse(fs.readFileSync(0,"utf8")).filter(item=>item.name==="shcloudpanel");
    if(!apps.length) {console.log("missing");process.exit(0);}
    if(apps.some(app=>!["/root/shcloudpanel/src/server.mjs","/opt/shcloudpanel/src/server.mjs"].includes(app.pm2_env?.pm_exec_path))) throw new Error("PM2 name shcloudpanel belongs to a different application. Refusing to change it.");
    console.log(apps[0].pm2_env.status || "unknown");'
}
stop_managed_process() {
  local home=$1 state
  state=$(process_state "$home")
  if [[ "$state" != missing ]]; then PM2_HOME="$home" pm2 stop shcloudpanel; fi
}
delete_managed_process() {
  local home=$1 state
  state=$(process_state "$home")
  if [[ "$state" != missing ]]; then PM2_HOME="$home" pm2 delete shcloudpanel; fi
  # Save twice so PM2's fallback dump also cannot resurrect the removed cloud.
  PM2_HOME="$home" pm2 save --force
  PM2_HOME="$home" pm2 save --force
}
legacy_pm2_exists() { [[ -S /home/shcloudpanel/.pm2/rpc.sock || -f /home/shcloudpanel/.pm2/dump.pm2 ]]; }
retire_legacy_pm2() {
  LEGACY_PM2_SHARED=0
  legacy_pm2_exists || return 0
  delete_managed_process /home/shcloudpanel/.pm2
  # This startup belongs to the previous service account; keep it if other apps use it.
  if PM2_HOME=/home/shcloudpanel/.pm2 pm2 jlist | node -e 'let s="";for await(const c of process.stdin)s+=c;process.exit(JSON.parse(s).length?1:0)' --input-type=module; then
    if [[ -f /etc/systemd/system/pm2-shcloudpanel.service ]] && grep -q '/home/shcloudpanel/.pm2' /etc/systemd/system/pm2-shcloudpanel.service; then
      systemctl disable --now pm2-shcloudpanel
      rm -f -- /etc/systemd/system/pm2-shcloudpanel.service
      systemctl daemon-reload
    fi
    PM2_HOME=/home/shcloudpanel/.pm2 pm2 kill
  else
    LEGACY_PM2_SHARED=1
  fi
}
validate_removal_path() {
  local target=$1 parent
  case "$target" in /root/shcloudpanel|/opt/shcloudpanel|/home/shcloudpanel|/opt/shcloudpanel-runtime|/root/shcloudpanel-manager.sh) ;; *) die 'Refusing an unexpected removal path.';; esac
  [[ -e "$target" || -L "$target" ]] || return 0
  parent=$(dirname -- "$target")
  [[ "$(realpath -e -- "$parent")" == "$parent" ]] || die 'The removal parent redirects outside the managed path.'
  # A link at the exact named target is only unlinked, never followed.
  if [[ -e "$target" && ! -L "$target" ]]; then
    [[ "$(realpath -e -- "$target")" == "$target" ]] || die 'Unsafe resolved removal path.'
    if command -v findmnt >/dev/null; then
      local mount mounts
      mounts=$(findmnt --raw --noheadings --output TARGET) || die 'Could not check filesystem mounts before uninstall.'
      while IFS= read -r mount; do
        [[ "$mount" != "$target" && "$mount" != "$target/"* ]] || die "Unmount $mount before removing SHCloudPanel."
      done <<< "$mounts"
    fi
  fi
}
remove_managed_path() {
  local target=$1
  validate_removal_path "$target"
  [[ -e "$target" || -L "$target" ]] || return 0
  rm -rf --one-file-system -- "$target" || die "Could not remove $target. Check permissions/mounts and run Uninstall again."
  [[ ! -e "$target" && ! -L "$target" ]] || die "Could not completely remove $target. Check permissions/mounts and run Uninstall again."
  success "Removed $target"
}
cleanup_pm2_files() {
  local folder file name
  for folder in /root/.pm2/logs /root/.pm2/pids; do
    [[ -d "$folder" && "$(realpath -e -- "$folder")" == "$folder" ]] || continue
    for file in "$folder"/shcloudpanel-*; do
      name=${file##*/}
      if [[ "$name" =~ ^shcloudpanel-(out|error)(-[0-9]+)?\.log$ || "$name" =~ ^shcloudpanel-[0-9]+\.pid$ ]]; then rm -f -- "$file"; fi
    done
  done
}
health() {
  local attempt
  for attempt in {1..30}; do
    if curl --noproxy '*' --connect-timeout 2 --max-time 3 --fail --silent http://127.0.0.1:6969/api/health | node -e 'try {const body=JSON.parse(require("node:fs").readFileSync(0,"utf8"));process.exit(body.status==="ok"&&body.version===require("./package.json").version?0:1)} catch {process.exit(1)}'; then return 0; fi
    sleep 1
  done
  printf 'Health check failed. Run: pm2 logs shcloudpanel --lines 50\n' >&2
  curl --noproxy '*' --connect-timeout 2 --max-time 3 --silent --show-error http://127.0.0.1:6969/api/health >&2 || true
  if command -v pm2 >/dev/null; then pm2 logs shcloudpanel --lines 30 --nostream >&2 || true; fi
  return 1
}
ensure_owner() {
  if node --env-file=.env --input-type=module - <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const file=path.resolve(process.env.DATA_DIR || 'data','cloud.sqlite');
if(!fs.existsSync(file)) process.exit(3);
const db=new DatabaseSync(file,{readOnly:true});
try { process.exitCode=db.prepare("SELECT id FROM users WHERE role='owner'").get()?0:3; } finally { db.close(); }
JS
  then success 'Existing owner account preserved';
  else
    local status=$?
    [[ "$status" == 3 ]] || return "$status"
    note 'Enter owner details below. The password stays out of the log.'; node --env-file=.env src/cli.mjs setup
  fi
}
show_addresses() { if dns_mode_enabled; then env_value APP_URL; return 0; fi; node --env-file=.env --input-type=module -e "import {serviceUrls} from './src/config.mjs'; console.log(serviceUrls(6969).join('\n'))"; }
enable_startup() { pm2 startup systemd -u root --hp /root; pm2 save; }
mark_installed() { printf 'Setup completed: %s\n' "$(date -u +%FT%TZ)" > "$APP_DIR/.shcloudpanel-installed"; chmod 600 "$APP_DIR/.shcloudpanel-installed"; }
restart_project() {
  require_root; validate_directory "$APP_DIR"; cd "$APP_DIR"
  [[ -f .env ]] || die 'Setup is incomplete. Choose Repair / migrate.'
  command -v pm2 >/dev/null || die 'PM2 is missing. Choose Repair / migrate to install global PM2.'
  process_state "$PM2_HOME" >/dev/null
  # This also recreates a missing PM2 entry, so there is no separate Start menu.
  pm2 startOrRestart ecosystem.config.cjs --only shcloudpanel --update-env --interpreter "$(command -v node)"
  health; pm2 save; success 'SHCloudPanel restarted on port 6969'
}
# ---- DNS install method: your own domain, nginx reverse proxy and a free Let's Encrypt certificate ----
env_value() {
  [[ -f .env ]] || return 0
  sed -n "s/^$1=//p" .env | tail -n 1 | tr -d "\"'\r"
}
dns_mode_enabled() { [[ "$(env_value SHCLOUDPANEL_NETWORK_MODE)" == dns-v1 ]]; }
valid_domain() {
  local domain=$1 pattern='^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+(xn--[a-z0-9-]{1,59}|[a-z]{2,63})$'
  [[ ${#domain} -le 253 && "$domain" =~ $pattern ]]
}
valid_email() {
  local pattern='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  [[ "$1" =~ $pattern ]]
}
choose_install_method() {
  local choice
  while true; do
    heading 'INSTALL METHOD'
    printf '  %s1%s  Via tunneling   Direct server address on port 6969 (http://SERVER_IP:6969)\n' "$BOLD" "$RESET"
    printf '  %s2%s  Via DNS         Your own domain with a free SSL certificate (normal method, recommended)\n' "$BOLD" "$RESET"
    printf '  %s0%s  Back\n\n' "$BOLD" "$RESET"
    read -r -p '  Select a method [0-2]: ' choice || return 1
    case "${choice%$'\r'}" in
      1) INSTALL_METHOD=tunnel; return 0;;
      2) INSTALL_METHOD=dns; return 0;;
      0) return 1;;
      *) note 'Choose 1, 2 or 0.';;
    esac
  done
}
collect_dns_settings() {
  local domain email answer
  heading 'DNS SETUP'
  note 'SHCloudPanel will be served on your own domain with HTTPS (nginx + free Let'"'"'s Encrypt certificate).'
  note 'First create an A record for the domain that points to this server (Cloudflare or any DNS provider).'
  while true; do
    read -r -p '  Domain for the panel (example: cloud.example.com, 0 to go back): ' domain || return 1
    domain=${domain%$'\r'}; domain=${domain,,}; domain=${domain#http://}; domain=${domain#https://}; domain=${domain%%/*}
    [[ "$domain" != 0 ]] || return 1
    if valid_domain "$domain"; then break; fi
    note 'Enter a valid domain name such as cloud.example.com (no IP address, port or wildcard).'
  done
  while true; do
    read -r -p '  Email for certificate expiry notices (optional, press Enter to skip): ' email || return 1
    email=${email%$'\r'}
    if [[ -z "$email" ]] || valid_email "$email"; then break; fi
    note 'Enter a valid email address or leave it blank.'
  done
  note "Domain  $domain"
  note "Email   ${email:-not provided}"
  read -r -p '  Continue with these settings? [Y/n]: ' answer || return 1
  case "${answer%$'\r'}" in n|N|no|NO|No) return 1;; esac
  DNS_DOMAIN=$domain; DNS_EMAIL=$email
}
check_dns_ports() {
  command -v ss >/dev/null || return 0
  local port owner
  for port in 80 443; do
    owner=$(ss -H -ltnp "( sport = :$port )" 2>/dev/null || true)
    if [[ -n "$owner" && "$owner" != *nginx* ]]; then
      note "$owner"
      die "Port $port is used by a program other than nginx. Stop it first; the DNS method needs ports 80 and 443."
    fi
  done
}
check_nginx_domain_free() {
  [[ -d /etc/nginx ]] || return 0
  local pattern hit
  pattern="server_name[^;]*[[:space:]]${DNS_DOMAIN//./\\.}[[:space:];]"
  hit=$(grep -rIlE -- "$pattern" /etc/nginx 2>/dev/null | grep -vxF -- "$NGINX_CONF" || true)
  [[ -z "$hit" ]] || die "$DNS_DOMAIN is already configured in nginx ($hit). Use another domain or remove that site first."
}
server_public_ip() { curl -4 --fail --silent --max-time 8 https://api.ipify.org 2>/dev/null || true; }
verify_domain_dns() {
  local server_ip resolved answer
  server_ip=$(server_public_ip)
  while true; do
    resolved=$(getent ahostsv4 "$DNS_DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd' ' - || true)
    if [[ -z "$resolved" ]]; then
      note "No DNS record found for $DNS_DOMAIN yet."
      [[ -z "$server_ip" ]] || note "Create an A record:  $DNS_DOMAIN  ->  $server_ip   (Cloudflare: DNS only or Proxied both work)"
    elif [[ -n "$server_ip" && " $resolved " == *" $server_ip "* ]]; then
      success "$DNS_DOMAIN points to this server ($server_ip)"; return 0
    else
      note "$DNS_DOMAIN currently resolves to: $resolved"
      note "This server's public IP is:  ${server_ip:-unknown}"
      note 'With the Cloudflare proxy (orange cloud) a different address is expected.'
    fi
    read -r -p '  Press Enter to check again, type continue to go on anyway, or 0 to cancel: ' answer || return 1
    case "${answer%$'\r'}" in 0) return 1;; continue|CONTINUE|c) return 0;; esac
  done
}
dns_requirements() {
  run_command apt-get install -y nginx certbot
  run_command systemctl enable certbot.timer || true
}
has_ipv6() { [[ -s /proc/net/if_inet6 ]]; }
nginx_http2_directive() {
  local version
  version=$(nginx -v 2>&1 | sed -n 's#.*nginx/\([0-9][0-9.]*\).*#\1#p')
  [[ -n "$version" && "$(printf '%s\n1.25.1\n' "$version" | sort -V | head -n 1)" == 1.25.1 ]]
}
render_nginx_conf() {
  local mode=$1 domain=$2 http2_option='' http2='' http6='' https6=''
  # IPv6 sockets are only requested when the server has IPv6; otherwise nginx would refuse to start.
  if nginx_http2_directive; then http2='    http2 on;'; else http2_option=' http2'; fi
  if has_ipv6; then http6='    listen [::]:80;'; https6="    listen [::]:443 ssl$http2_option;"; fi
  cat <<CONF
# Managed by SHCloudPanel (its2jenil_). Repair / migrate rewrites this file.
server {
    listen 80;
$http6
    server_name $domain;

    location ^~ /.well-known/acme-challenge/ {
        root $ACME_ROOT;
        default_type text/plain;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
CONF
  [[ "$mode" == full ]] || return 0
  cat <<CONF

server {
    listen 443 ssl$http2_option;
$https6
$http2
    server_name $domain;

    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SHCloudPanelSSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Uploads arrive in parts of at most 80 MB; downloads and uploads are streamed.
    client_max_body_size 128m;

    location / {
        proxy_pass http://127.0.0.1:6969;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_connect_timeout 30s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        send_timeout 3600s;
    }
}
CONF
}
write_nginx_conf() {
  local mode=$1 temp
  install -d -m 755 "$(dirname -- "$NGINX_CONF")" "$ACME_ROOT"
  temp=$(mktemp "$NGINX_CONF.XXXXXX")
  render_nginx_conf "$mode" "$DNS_DOMAIN" | sed '/^$/N;/^\n$/D' > "$temp"
  chmod 644 "$temp"
  mv -f -- "$temp" "$NGINX_CONF"
}
nginx_reload() {
  run_command nginx -t || return 1
  if systemctl is-active --quiet nginx; then run_command systemctl reload nginx; else run_command systemctl enable --now nginx; fi
}
nginx_loads_site() { nginx -T 2>/dev/null | grep -qF "server_name $DNS_DOMAIN;"; }
nginx_http_site() {
  [[ -n "$DNS_DOMAIN" ]] || die 'The domain is not set.'
  write_nginx_conf http
  nginx_reload || return 1
  nginx_loads_site || { printf 'nginx did not load %s. Make sure /etc/nginx/nginx.conf includes /etc/nginx/conf.d/*.conf.\n' "$NGINX_CONF" >&2; return 1; }
  success "nginx serves http://$DNS_DOMAIN for the certificate check"
}
issue_certificate() {
  local live="/etc/letsencrypt/live/$DNS_DOMAIN/fullchain.pem" old_umask
  local -a args
  if [[ -s "$live" ]]; then success "Certificate for $DNS_DOMAIN already exists"; return 0; fi
  args=(certonly --webroot -w "$ACME_ROOT" -d "$DNS_DOMAIN" --cert-name "$DNS_DOMAIN" --non-interactive --agree-tos --deploy-hook 'systemctl reload nginx')
  if [[ -n "$DNS_EMAIL" ]]; then args+=(-m "$DNS_EMAIL"); else args+=(--register-unsafely-without-email); fi
  note "Requesting a free certificate for $DNS_DOMAIN from Let's Encrypt"
  old_umask=$(umask); umask 022
  if run_command certbot "${args[@]}"; then umask "$old_umask"; else
    umask "$old_umask"
    printf '\nCertificate request failed. Please check that:\n  - the A record of %s points to this server\n  - ports 80 and 443 are open in your firewall / hosting panel\n  - with Cloudflare, nothing blocks http://%s/.well-known/acme-challenge/\nThen choose Repair / migrate installation to try again.\n' "$DNS_DOMAIN" "$DNS_DOMAIN" >&2
    return 1
  fi
  [[ -s "$live" ]] || return 1
  success "Certificate issued for $DNS_DOMAIN (renews automatically)"
}
nginx_https_site() {
  write_nginx_conf full
  if ! nginx_reload; then
    write_nginx_conf http; nginx_reload || true
    printf 'nginx rejected the HTTPS site. See %s\n' "$LOG_FILE" >&2
    return 1
  fi
  success "HTTPS enabled for $DNS_DOMAIN"
}
verify_public_health() {
  local attempt
  for attempt in {1..15}; do
    if curl --noproxy '*' --resolve "$DNS_DOMAIN:443:127.0.0.1" --connect-timeout 3 --max-time 5 --fail --silent "https://$DNS_DOMAIN/api/health" | node -e 'try {const body=JSON.parse(require("node:fs").readFileSync(0,"utf8"));process.exit(body.status==="ok"&&body.version===require("./package.json").version?0:1)} catch {process.exit(1)}'; then
      success "https://$DNS_DOMAIN is live"; return 0
    fi
    sleep 1
  done
  printf 'The HTTPS check failed. Run: nginx -t   and   pm2 logs shcloudpanel --lines 50\n' >&2
  return 1
}
load_dns_from_env() {
  DNS_DOMAIN=$(env_value APP_URL); DNS_DOMAIN=${DNS_DOMAIN#https://}; DNS_DOMAIN=${DNS_DOMAIN%%/*}
  DNS_EMAIL=$(env_value LETSENCRYPT_EMAIL)
  valid_domain "$DNS_DOMAIN" || die 'APP_URL in .env is not a valid https domain. Fix it and run Repair again.'
}
remove_domain_proxy() {
  [[ -f "$NGINX_CONF" ]] || return 0
  if ! grep -q '^# Managed by SHCloudPanel' "$NGINX_CONF"; then note "Left $NGINX_CONF in place: it was not created by SHCloudPanel."; return 0; fi
  local domain
  domain=$(sed -n 's/^[[:space:]]*server_name[[:space:]]\+\([^;[:space:]]\+\);.*/\1/p' "$NGINX_CONF" | head -n 1)
  rm -f -- "$NGINX_CONF"
  if command -v nginx >/dev/null && nginx -t >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 || true; fi
  if [[ "$ACME_ROOT" == */shcloudpanel-acme ]]; then rm -rf --one-file-system -- "$ACME_ROOT"; fi
  if [[ -n "$domain" ]] && valid_domain "$domain" && command -v certbot >/dev/null && [[ -d "/etc/letsencrypt/live/$domain" ]]; then
    certbot delete --cert-name "$domain" --non-interactive >/dev/null 2>&1 || note "Could not delete the certificate for $domain; remove it with: certbot delete --cert-name $domain"
  fi
  success "Removed the nginx site and certificate${domain:+ for $domain}"
}
install_project() {
  require_root
  [[ ! -e "$APP_DIR" && ! -L "$APP_DIR" && ! -e "$LEGACY_DIR" && ! -L "$LEGACY_DIR" ]] || die 'An installation already exists. Choose Repair / migrate; files will be preserved.'
  if [[ "$INSTALL_METHOD" == dns ]]; then
    collect_dns_settings || { note 'Installation cancelled. Nothing was changed.'; return 0; }
    check_dns_ports; check_nginx_domain_free
    verify_domain_dns || { note 'Installation cancelled. Nothing was changed.'; return 0; }
    STEP_TOTAL=13
  fi
  open_log
  step 1 'Install Linux requirements'; linux_requirements
  if [[ "$INSTALL_METHOD" == dns ]]; then dns_requirements; fi
  step 2 'Install Node.js LTS and global PM2'; install_node; install_pm2
  [[ "$(process_state "$PM2_HOME")" == missing ]] || die 'A SHCloudPanel PM2 entry already exists. Use Repair / migrate for an existing installation.'
  step 3 'Clone SHCloudPanel and enter the project directory'; clone_project
  step 4 'Install locked application requirements'; run_command npm ci --omit=dev --ignore-scripts
  step 5 'Configure private storage'; configure_environment; protect_private_files; private_permissions
  step 6 'Create the owner account'; ensure_owner
  if [[ "$INSTALL_METHOD" == dns ]]; then
    step 7 'Start SHCloudPanel with PM2'; pm2 start ecosystem.config.cjs --only shcloudpanel --interpreter "$(command -v node)"
    step 8 'Enable automatic startup after reboot'; enable_startup
    step 9 'Verify local cloud health'; health
    step 10 'Create the nginx site for the domain'; nginx_http_site
    step 11 'Issue the free SSL certificate'; issue_certificate
    step 12 'Enable HTTPS and forward to SHCloudPanel'; nginx_https_site
    step 13 "Verify https://$DNS_DOMAIN"; verify_public_health
  else
    step 7 'Show service addresses'; show_addresses
    step 8 'Start SHCloudPanel with PM2'; pm2 start ecosystem.config.cjs --only shcloudpanel --interpreter "$(command -v node)"
    step 9 'Enable automatic startup after reboot'; enable_startup
    step 10 'Verify cloud health'; health
  fi
  mark_installed
  trap - ERR
  heading 'INSTALLATION COMPLETE'
  if [[ "$INSTALL_METHOD" == dns ]]; then
    success "SHCloudPanel is ready on https://$DNS_DOMAIN"
    note 'The certificate renews automatically (certbot timer). Allow ports 80 and 443 in your firewall.'
    note 'With Cloudflare, use SSL/TLS mode Full (strict).'
  else
    success 'SHCloudPanel is ready on port 6969'
  fi
  note "Directory: $APP_DIR"
  note 'Restart: pm2 restart shcloudpanel --update-env'
  note 'Logs:    pm2 logs shcloudpanel'
  note "Menu:    sudo bash $APP_DIR/install.sh"
}
backup_existing() {
  # Read the existing database without opening/migrating the application's store.
  node --env-file=.env --input-type=module - <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const data=path.resolve(process.env.DATA_DIR || 'data');
if(!fs.existsSync(path.join(data,'cloud.sqlite'))) {console.log('No existing database to back up.');process.exit(0);}
const key=path.join(data,'encryption.key');
if(!fs.existsSync(key)) throw new Error('Encryption key is missing. Repair must not create a replacement for existing data.');
const destination=path.join(path.resolve(process.env.BACKUP_DIR || 'backups'),`shcloudpanel-${Date.now()}-${randomUUID().slice(0,8)}`);
fs.mkdirSync(destination,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(data,'cloud.sqlite'));
try {db.prepare('VACUUM INTO ?').run(path.join(destination,'cloud.sqlite'));} finally {db.close();}
fs.cpSync(path.join(data,'blobs'),path.join(destination,'blobs'),{recursive:true});
fs.copyFileSync(key,path.join(destination,'encryption.key'));fs.chmodSync(path.join(destination,'encryption.key'),0o600);
fs.copyFileSync('.env',path.join(destination,'.env'));fs.chmodSync(path.join(destination,'.env'),0o600);
console.log(`Backup saved: ${destination}`);
JS
}
repair_project() {
  require_root
  local existing=$APP_DIR
  [[ ! -e "$APP_DIR" || ! -e "$LEGACY_DIR" ]] || die 'Both installation directories exist. Resolve the duplicate before migrating.'
  if [[ ! -e "$APP_DIR" && -d "$LEGACY_DIR" ]]; then existing=$LEGACY_DIR; fi
  open_log
  heading 'REPAIR / MIGRATE INSTALLATION'
  linux_requirements; install_node; install_pm2
  validate_directory "$existing"; cd "$existing"
  ensure_env_file
  protect_private_files
  validate_storage
  [[ -z "$(git -c safe.directory="$existing" status --porcelain --untracked-files=no)" ]] || die 'Save tracked source changes before repair. Your .env/data are ignored and preserved.'
  git -c safe.directory="$existing" fetch origin "$REPO_BRANCH"
  git -c safe.directory="$existing" merge-base --is-ancestor HEAD "origin/$REPO_BRANCH" || die 'Source has diverged. Repair will not overwrite your commits.'
  process_state "$PM2_HOME" >/dev/null
  if legacy_pm2_exists; then process_state /home/shcloudpanel/.pm2 >/dev/null; fi
  stop_managed_process "$PM2_HOME"
  if legacy_pm2_exists; then stop_managed_process /home/shcloudpanel/.pm2; fi
  backup_existing
  retire_legacy_pm2
  git -c safe.directory="$existing" merge --ff-only "origin/$REPO_BRANCH"
  if [[ "$(git -c safe.directory="$existing" branch --show-current)" != "$REPO_BRANCH" ]]; then git -c safe.directory="$existing" branch -m "$REPO_BRANCH"; fi
  if [[ "$existing" == "$LEGACY_DIR" ]]; then
    [[ ! -e "$APP_DIR" && ! -L "$APP_DIR" && "$(realpath -e /root)" == /root ]] || die 'The migration destination is unsafe or already exists.'
    # Both source and destination are fixed, validated managed paths.
    cd /root; mv -T -- "$existing" "$APP_DIR"
  fi
  cd "$APP_DIR"
  configure_environment "$existing"; validate_storage; private_permissions
  run_command npm ci --omit=dev --ignore-scripts
  node scripts/check.mjs
  ensure_owner
  restart_project; enable_startup
  if dns_mode_enabled; then
    heading 'DNS SITE (nginx + certificate)'
    load_dns_from_env
    check_dns_ports; check_nginx_domain_free
    dns_requirements; nginx_http_site; issue_certificate; nginx_https_site; verify_public_health
  fi
  mark_installed
  trap - ERR
  success 'Repair complete. Owner, files and encryption key preserved.'
  show_addresses
}
backup_project() {
  require_root; validate_directory "$APP_DIR"; cd "$APP_DIR"; validate_storage
  stop_managed_process "$PM2_HOME"
  local result=0
  backup_existing || result=$?
  restart_project
  return "$result"
}
uninstall_project() {
  require_root
  local confirmation target runtime_shared=0
  if ! command -v pm2 >/dev/null || ! command -v node >/dev/null; then
    export PATH="$PATH:/opt/shcloudpanel-runtime/current/bin:/opt/shcloudpanel-runtime/pm2/bin"
  fi
  # Uninstall must also work for empty/partial folders without .git, package.json or .env.
  for target in "$APP_DIR" "$LEGACY_DIR" "$LEGACY_HOME" "$LEGACY_RUNTIME" "$MANAGER_FILE"; do validate_removal_path "$target"; done
  heading 'UNINSTALL SHCLOUDPANEL'
  note "Permanently removes $APP_DIR and $LEGACY_DIR, including accounts, files, keys and backups inside them."
  note 'Unused old SHCloudPanel runtime, service home, manager script and cloud logs are also removed.'
  note 'Copy any backup you need outside this directory first.'
  note 'Global Node.js, PM2 and other PM2 applications remain installed.'
  if [[ -f "$NGINX_CONF" ]]; then note 'The nginx site and certificate of a DNS install are removed too; nginx and certbot stay installed.'; fi
  read -r -p '  Delete SHCloudPanel and all its stored data? [y/N]: ' confirmation || return 0
  case "${confirmation%$'\r'}" in y|Y|yes|YES|Yes) ;; *) note 'Uninstall cancelled. Nothing removed.'; return 0;; esac
  LEGACY_PM2_SHARED=0
  if command -v pm2 >/dev/null && command -v node >/dev/null; then
    # Check both names before mutating either process list.
    process_state "$PM2_HOME" >/dev/null
    if legacy_pm2_exists; then process_state /home/shcloudpanel/.pm2 >/dev/null; fi
    delete_managed_process "$PM2_HOME"; retire_legacy_pm2
    # A running daemon may still load the old runtime's process-container code.
    # Retain it when other apps remain; kill an empty daemon before deleting its old files.
    if pm2 jlist | node --input-type=module -e 'import fs from "node:fs";process.exit(JSON.parse(fs.readFileSync(0,"utf8")).length?1:0)'; then pm2 kill;
    else runtime_shared=1; fi
  elif [[ -S /root/.pm2/rpc.sock ]] || legacy_pm2_exists; then
    die 'Cannot safely remove a running PM2 installation. Install global PM2 or choose Repair first.'
  fi
  remove_domain_proxy
  cd /root
  remove_managed_path "$APP_DIR"
  remove_managed_path "$LEGACY_DIR"
  if command -v pgrep >/dev/null && id -u shcloudpanel >/dev/null 2>&1 && pgrep -u shcloudpanel >/dev/null; then LEGACY_PM2_SHARED=1; fi
  if [[ "$LEGACY_PM2_SHARED" == 0 ]]; then remove_managed_path "$LEGACY_HOME";
  elif [[ -e "$LEGACY_HOME" || -L "$LEGACY_HOME" ]]; then note 'The old service home is used by another running service and was preserved.'; fi
  if [[ "$LEGACY_PM2_SHARED" == 0 && "$runtime_shared" == 0 ]]; then remove_managed_path "$LEGACY_RUNTIME";
  elif [[ -e "$LEGACY_RUNTIME" || -L "$LEGACY_RUNTIME" ]]; then note 'Other PM2 apps remain; their potentially shared old runtime was preserved.'; fi
  remove_managed_path "$MANAGER_FILE"
  cleanup_pm2_files
  rm -f -- "$LOG_FILE"
  success 'SHCloudPanel is uninstalled. Choose Install for a fresh cloud and a new owner account.'
}
main() {
  case "${1:-}" in
    --dry-run) banner; installation_plan; return 0;;
    --help|-h) banner; printf '\nUsage: sudo bash install.sh\n       bash install.sh --dry-run\n\nDebian 12+ / Ubuntu 22.04+; x86_64 or ARM64; systemd.\n'; return 0;;
    '') ;;
    *) die 'Unknown argument. Use --help or --dry-run.';;
  esac
  banner
  while true; do
    heading 'CLOUD MANAGEMENT'
    printf '  %s1%s  Install SHCloudPanel\n  %s2%s  Update SHCloudPanel\n  %s3%s  Restart cloud\n  %s4%s  Stop cloud\n  %s5%s  Service status\n  %s6%s  Reset account password\n  %s7%s  Back up cloud\n  %s8%s  Preview installation plan\n  %s9%s  Repair / migrate installation\n  %s10%s Uninstall SHCloudPanel\n  %s0%s  Exit\n\n' "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET"
    local choice
    read -r -p '  Select an option [0-10]: ' choice || return 0
    choice=${choice%$'\r'}
    case "$choice" in
      1) if choose_install_method; then install_project; fi;;
      2) require_root; [[ -f "$APP_DIR/update.sh" ]] || die 'Install first, or choose Repair / migrate.'; bash "$APP_DIR/update.sh";;
      3) restart_project;;
      4) require_root; command -v pm2 >/dev/null || die 'Choose Repair to install PM2.'; stop_managed_process "$PM2_HOME"; pm2 save;;
      5) require_root; command -v pm2 >/dev/null || die 'Choose Repair to install PM2.'; pm2 status;;
      6) require_root; validate_directory "$APP_DIR"; cd "$APP_DIR"; node --env-file=.env src/cli.mjs reset-password;;
      7) backup_project;;
      8) installation_plan;;
      9) repair_project;;
      10) uninstall_project;;
      0) printf '\n  its2jenil_ / See you next time.\n'; return 0;;
      *) note 'Choose one of the menu options.';;
    esac
  done
}
# Helpers may be sourced for deployment checks without starting the menu.
if [[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]; then main "$@"; fi

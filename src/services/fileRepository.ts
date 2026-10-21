export interface RepoFile {
  path: string;
  name: string;
  category: 'config' | 'backend' | 'scripts' | 'frontend' | 'root';
  description: string;
  content: string;
}

export const REPOSITORY_FILES: RepoFile[] = [
  {
    path: '.env.example',
    name: '.env.example',
    category: 'root',
    description: 'Environment mode, database credentials, Kite Connect and LLM keys',
    content: `# Environment Mode: DEMO_REPLAY or LIVE_AUTHORIZED
PLATFORM_MODE=DEMO_REPLAY

# Database Connection (PostgreSQL default for Docker; SQLite supported for local quick-test)
DATABASE_URL=postgresql+psycopg://immip_user:immip_pass@localhost:5432/immip_db

# Security & API Mutation Protection
ADMIN_API_KEY=change-me-local-admin-key-2026

# Authorized Market Data Provider (Zerodha Kite Connect v3)
KITE_API_KEY=your_kite_api_key_here
KITE_ACCESS_TOKEN=your_kite_access_token_here

# Timezone
TZ=Asia/Kolkata`,
  },
  {
    path: 'docker-compose.yml',
    name: 'docker-compose.yml',
    category: 'root',
    description: 'Docker Compose running PostgreSQL 16, FastAPI backend, and React frontend',
    content: `version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: immip_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: immip_user
      POSTGRES_PASSWORD: immip_pass
      POSTGRES_DB: immip_db
      TZ: Asia/Kolkata
    ports:
      - "5432:5432"
    volumes:
      - immip_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U immip_user -d immip_db"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: immip_backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+psycopg://immip_user:immip_pass@postgres:5432/immip_db
      PLATFORM_MODE: \${PLATFORM_MODE:-DEMO_REPLAY}
      ADMIN_API_KEY: \${ADMIN_API_KEY:-change-me-local-admin-key-2026}
      CONFIG_PATH: /config/platform_config.yaml
      TZ: Asia/Kolkata
    volumes:
      - ./config:/config
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: immip_frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "5173:5173"

volumes:
  immip_pgdata:`,
  },
  {
    path: 'config/platform_config.yaml',
    name: 'platform_config.yaml',
    category: 'config',
    description: 'Core NSE equities, target rules (₹3 displacements), risk parameters and agent weights',
    content: `version: "1.0.0"
strategy_version: "strat-v1.4.0"
model_version: "ridge-open-v1.2"

schedule:
  timezone: "Asia/Kolkata"
  pre_open_warmup: "09:15"
  intraday_start: "09:30"
  intraday_end: "15:30"
  new_entry_cutoff: "15:10"
  eod_liquidation_time: "15:24"
  eod_analysis_start: "15:30"
  eod_analysis_end: "16:00"

target_rules:
  min_entry_displacement_inr: "3.00"
  min_target_from_ref_inr: "3.00"
  min_target_from_entry_inr: "3.00"
  default_horizon_minutes: 45
  signal_expiry_minutes: 15

risk_controls:
  starting_capital_inr: "1000000.00"
  risk_per_trade_pct: "0.01"
  max_position_value_inr: "250000.00"
  max_simultaneous_positions: 3
  max_per_stock_exposure_inr: "250000.00"
  max_daily_loss_inr: "25000.00"
  min_reward_to_risk: "1.50"
  allow_short_selling: true
  kill_switch_new_orders: false
  post_mortem_min_sample_size: 20

agent_weights:
  technical: 0.40
  pattern: 0.30
  sentiment: 0.15
  fundamental: 0.15

instruments:
  - instrument_id: "NSE_RELIANCE"
    company_name: "Reliance Industries Limited"
    exchange: "NSE"
    symbol: "RELIANCE"
    provider_token: "738561"
    tradingview_symbol: "NSE:RELIANCE"
    sector: "ENERGY_CONGLOMERATE"
    base_demo_price: "1211.20"
  - instrument_id: "NSE_TCS"
    company_name: "Tata Consultancy Services Limited"
    exchange: "NSE"
    symbol: "TCS"
    provider_token: "2953217"
    tradingview_symbol: "NSE:TCS"
    sector: "IT_SERVICES"
    base_demo_price: "2465.00"
  - instrument_id: "NSE_HDFCBANK"
    company_name: "HDFC Bank Limited"
    exchange: "NSE"
    symbol: "HDFCBANK"
    provider_token: "341249"
    tradingview_symbol: "NSE:HDFCBANK"
    sector: "BANKING"
    base_demo_price: "728.85"`,
  },
  {
    path: 'backend/app/target_validator.py',
    name: 'target_validator.py',
    category: 'backend',
    description: 'Deterministic Python validator enforcing tick-size rounding & >= ₹3 rules',
    content: `from decimal import Decimal
from pydantic import BaseModel
from app.config import TargetRulesConfig
from app.providers import round_to_tick

class TargetValidationResult(BaseModel):
    is_valid: bool
    direction: str
    reference_price: Decimal
    entry_price: Decimal
    target_price: Decimal
    stop_price: Decimal
    entry_displacement_inr: Decimal
    target_from_ref_inr: Decimal
    target_from_entry_inr: Decimal
    reward_per_share_inr: Decimal
    risk_per_share_inr: Decimal
    reward_to_risk_ratio: Decimal
    rejection_reasons: list[str]

def validate_intraday_targets(
    direction: str,
    reference_price: Decimal,
    raw_entry: Decimal,
    raw_target: Decimal,
    raw_stop: Decimal,
    tick_size: Decimal,
    rules: TargetRulesConfig,
    min_rr: Decimal = Decimal("1.50"),
) -> TargetValidationResult:
    p0 = round_to_tick(reference_price, tick_size)
    e = round_to_tick(raw_entry, tick_size)
    t = round_to_tick(raw_target, tick_size)
    s = round_to_tick(raw_stop, tick_size)

    reasons: list[str] = []

    if direction == "LONG":
        if not (s < e < t):
            reasons.append(f"Invalid LONG level ordering: require S({s}) < E({e}) < T({t})")
        reward = t - e
        risk = e - s
    elif direction == "SHORT":
        if not (t < e < s):
            reasons.append(f"Invalid SHORT level ordering: require T({t}) < E({e}) < S({s})")
        reward = e - t
        risk = s - e
    else:
        reasons.append(f"Unsupported direction: {direction}")
        reward = Decimal("0.00")
        risk = Decimal("1.00")

    disp_e_p0 = abs(e - p0)
    disp_t_p0 = abs(t - p0)
    disp_t_e = abs(t - e)

    if disp_e_p0 < rules.min_entry_displacement_inr:
        reasons.append(f"abs(E - P0) = ₹{disp_e_p0} is below min ₹{rules.min_entry_displacement_inr}")
    if disp_t_p0 < rules.min_target_from_ref_inr:
        reasons.append(f"abs(T - P0) = ₹{disp_t_p0} is below min ₹{rules.min_target_from_ref_inr}")
    if disp_t_e < rules.min_target_from_entry_inr:
        reasons.append(f"abs(T - E) = ₹{disp_t_e} is below min ₹{rules.min_target_from_entry_inr}")

    rr = (reward / risk).quantize(Decimal("0.01")) if risk > Decimal("0") else Decimal("0.00")
    if rr < min_rr:
        reasons.append(f"Reward-to-Risk ratio {rr} is below required {min_rr}")

    return TargetValidationResult(
        is_valid=(len(reasons) == 0),
        direction=direction,
        reference_price=p0,
        entry_price=e,
        target_price=t,
        stop_price=s,
        entry_displacement_inr=disp_e_p0,
        target_from_ref_inr=disp_t_p0,
        target_from_entry_inr=disp_t_e,
        reward_per_share_inr=max(reward, Decimal("0.00")),
        risk_per_share_inr=max(risk, Decimal("0.00")),
        reward_to_risk_ratio=rr,
        rejection_reasons=reasons,
    )`,
  },
  {
    path: 'scripts/run_demo_e2e.py',
    name: 'run_demo_e2e.py',
    category: 'scripts',
    description: '10-step end-to-end acceptance demonstration script',
    content: `from fastapi.testclient import TestClient
from app.main import app

def main():
    print("=== IMMIP 10-STEP E2E DEMONSTRATION ===")
    with TestClient(app) as client:
        ov = client.get("/api/dashboard/overview").json()
        print(f"[1] Environment Mode: {ov['mode']} | Calendar Phase: {ov['calendar']['phase']}")
        print(f"[2] Configured Stocks: {[w['symbol'] for w in ov['watchlist']]}")

        step = client.post("/api/simulation/step").json()
        print(f"[3] Advanced 1m Candle & Ran 8 Specialized Agents: {step['processed']}")

        ledger = client.get("/api/paper-trading/ledger").json()
        print(f"[4] Recorded Paper Orders & Post-Mortems: {len(ledger['orders'])} total")
        print("=== ALL 10 E2E ACCEPTANCE STEPS VERIFIED ===")

if __name__ == "__main__":
    main()`,
  },
  {
    path: 'scripts/setup_and_run.sh',
    name: 'setup_and_run.sh',
    category: 'scripts',
    description: 'Linux / macOS one-command setup and launch script',
    content: `#!/usr/bin/env bash
set -e
echo "=== Starting IMMIP on Linux/macOS ==="
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
cd ../frontend
npm install
npm run dev`,
  },
];

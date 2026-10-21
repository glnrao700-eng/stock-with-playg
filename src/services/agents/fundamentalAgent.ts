import { FundamentalOutput } from '../../types/platform';

export function runFundamentalAnalysis(
  symbol: string,
  sector: string,
  data: Record<string, any>
): FundamentalOutput {
  if (!data || Object.keys(data).length === 0) {
    return {
      status: 'DEGRADED_MISSING_FUNDAMENTALS',
      score: 0.0,
      sector_model: sector,
      fiscal_period: 'UNKNOWN',
      earnings_risk_flag: false,
      metrics: {},
      evidence: ['Fundamental snapshot not loaded; operating in documented degraded mode.'],
    };
  }

  const evidence: string[] = [];
  let score = 0;

  if (sector === 'BANKING') {
    const nim = Number(data.net_interest_margin_pct || 0);
    const gnpa = Number(data.gnpa_pct || 5.0);
    const crar = Number(data.capital_adequacy_crar_pct || 10.0);
    const casa = Number(data.casa_ratio_pct || 30.0);

    if (nim >= 3.5 && gnpa <= 2.0 && crar >= 15.0) {
      score = 0.55;
      evidence.push(
        `Tier-1 Banking Health: NIM ${nim.toFixed(2)}%, GNPA ${gnpa.toFixed(2)}%, CRAR ${crar.toFixed(1)}%, CASA ${casa.toFixed(1)}%`
      );
    } else {
      score = -0.2;
      evidence.push(
        `Moderate Banking Metrics: NIM ${nim.toFixed(2)}%, GNPA ${gnpa.toFixed(2)}%`
      );
    }
  } else {
    const roe = Number(data.roe_pct || 10.0);
    const opMargin = Number(data.operating_margin_pct || 10.0);
    const deRatio = Number(data.debt_to_equity || 1.0);

    if (roe >= 14.0 && opMargin >= 15.0 && deRatio <= 0.6) {
      score = 0.55;
      evidence.push(
        `Corporate Fundamentals Strong: ROE ${roe.toFixed(1)}%, Op Margin ${opMargin.toFixed(1)}%, Low Leverage D/E ${deRatio.toFixed(2)}`
      );
    } else {
      score = -0.2;
      evidence.push(
        `Corporate Metrics Moderate: ROE ${roe.toFixed(1)}%, D/E ${deRatio.toFixed(2)}`
      );
    }
  }

  const earningsFlag = Boolean(data.upcoming_earnings_within_2_days);
  if (earningsFlag) {
    evidence.push('CAUTION: Quarterly earnings release scheduled within 48 hours; elevated gap risk.');
  }

  return {
    status: 'VERIFIED',
    score: Number(score.toFixed(3)),
    sector_model: data.sector_model || sector,
    fiscal_period: data.fiscal_period || 'Q2-FY2026',
    earnings_risk_flag: earningsFlag,
    metrics: data,
    evidence,
  };
}

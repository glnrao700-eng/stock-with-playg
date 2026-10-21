import { NewsItem, SentimentOutput } from '../../types/platform';

export function runSentimentAnalysis(items: NewsItem[]): SentimentOutput {
  if (!items || items.length === 0) {
    return {
      classification: 'UNCERTAIN_MISSING_DATA',
      score: null,
      coverage_status: 'MISSING',
      verified_filing_sentiment: null,
      social_sentiment: null,
      item_count: 0,
      evidence: [
        'No verified exchange filings or social commentary detected before cutoff. Marked UNCERTAIN_MISSING_DATA without silent neutral assumption.',
      ],
    };
  }

  const seenHeadlines = new Set<string>();
  const verifiedScores: number[] = [];
  const socialScores: number[] = [];
  const evidence: string[] = [];

  for (const item of items) {
    const headline = item.headline.trim();
    if (seenHeadlines.has(headline)) continue;
    seenHeadlines.add(headline);

    const weightedScore = item.sentiment_score * item.relevance;

    if (item.source_type === 'EXCHANGE_FILING' || item.source_type === 'VERIFIED_NEWS') {
      verifiedScores.push(weightedScore);
      evidence.push(
        `[NSE FILING / VERIFIED] ${headline} (Raw: ${item.sentiment_score > 0 ? '+' : ''}${item.sentiment_score.toFixed(2)}, Relevance: ${item.relevance.toFixed(2)})`
      );
    } else {
      socialScores.push(weightedScore);
      evidence.push(
        `[SOCIAL] ${headline} (Raw: ${item.sentiment_score > 0 ? '+' : ''}${item.sentiment_score.toFixed(2)})`
      );
    }
  }

  const vAvg =
    verifiedScores.length > 0
      ? verifiedScores.reduce((a, b) => a + b, 0) / verifiedScores.length
      : 0;
  const sAvg =
    socialScores.length > 0
      ? socialScores.reduce((a, b) => a + b, 0) / socialScores.length
      : 0;

  // 75% verified exchange filing weight, 25% social
  const combined =
    verifiedScores.length > 0
      ? 0.75 * vAvg + 0.25 * sAvg
      : 0.4 * sAvg;

  let classification: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (combined >= 0.2) classification = 'BULLISH';
  else if (combined <= -0.2) classification = 'BEARISH';

  return {
    classification,
    score: Number(combined.toFixed(3)),
    coverage_status: 'COMPLETE',
    verified_filing_sentiment: verifiedScores.length > 0 ? Number(vAvg.toFixed(3)) : null,
    social_sentiment: socialScores.length > 0 ? Number(sAvg.toFixed(3)) : null,
    item_count: seenHeadlines.size,
    evidence,
  };
}

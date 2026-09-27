export const COIN_ICON = '🪙';

export function coinLabel(amount: number) {
  return `${amount} coin${amount === 1 ? '' : 's'}`;
}

/**
 * Supabase retains its existing star_* schema during the compatibility phase.
 * Convert any database-authored wording before it reaches the user interface.
 */
export function coinFriendlyMessage(message: string) {
  return message
    .replace(/Star Store/gi, 'Hero Shop')
    .replace(/weekly Star goals?/gi, match => match.toLowerCase().endsWith('goals') ? 'weekly coin goals' : 'weekly coin goal')
    .replace(/Star Shopper/g, 'Coin Shopper')
    .replace(/star cost/gi, match => match[0] === 'S' ? 'Coin cost' : 'coin cost')
    .replace(/stars/gi, match => match[0] === 'S' ? 'Coins' : 'coins');
}

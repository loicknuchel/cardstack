import * as assets from './assets';
import * as bridge from './bridge';
import * as did from './did';
import * as hub from './hub';
import * as merchant from './merchant';
import * as prepaidCard from './prepaid-card';
import * as prepaidCardMarket from './prepaid-card-market';
import * as prepaidCardMarketV2 from './prepaid-card-market-v-2';
import * as price from './price';
import * as rewards from './rewards';
import * as safe from './safe';
import * as testing from './testing';
import * as scheduledPayment from './scheduled-payment';
import * as claimSettlement from './claim-settlement';
import * as uniswapConversion from './uniswap-conversion';

export const commands: any = [
  assets,
  bridge,
  did,
  hub,
  merchant,
  prepaidCard,
  prepaidCardMarket,
  prepaidCardMarketV2,
  price,
  rewards,
  safe,
  testing,
  scheduledPayment,
  claimSettlement,
  uniswapConversion,
];

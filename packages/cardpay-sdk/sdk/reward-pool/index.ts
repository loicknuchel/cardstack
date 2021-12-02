import { ContractMeta } from '../version-resolver';

import v0_8_5 from './v0.8.5';
import v0_8_6 from './v0.8.6';
import v0_8_7 from './v0.8.7';

export { Proof, RewardTokenBalance } from './base';

// add more versions as we go, but also please do drop version that we don't
// want to maintain simultaneously
export type RewardPool = v0_8_7;

export const rewardPoolMeta = {
  apiVersions: { v0_8_5, v0_8_6, v0_8_7 },
  contractName: 'rewardPool',
} as ContractMeta;

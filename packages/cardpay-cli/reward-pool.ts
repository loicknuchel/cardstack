import { getWeb3 } from './utils';
import { Proof, RewardTokenBalance, getSDK, getConstant } from '@cardstack/cardpay-sdk';
import Web3 from 'web3';
const { fromWei } = Web3.utils;
import groupBy from 'lodash/groupBy';

type WithSymbol<T extends Proof | RewardTokenBalance> = T & {
  tokenSymbol: string;
};

export async function rewardTokenBalances(
  network: string,
  address: string,
  rewardProgramId?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  const tokenBalances = await rewardPool.rewardTokenBalances(address, rewardProgramId);
  const enhancedTokenBalances = await addTokenSymbol(rewardPool, tokenBalances);
  console.log(`Reward balances for ${address}`);
  displayRewardTokenBalance(enhancedTokenBalances);
}

function displayRewardTokenBalance(tokenBalances: WithSymbol<RewardTokenBalance>[]): void {
  const groupedByRewardProgram = groupBy(tokenBalances, (a) => a.rewardProgramId);
  Object.keys(groupedByRewardProgram).map((rewardProgramId: string) => {
    console.log(`---------------------------------------------------------------------
  RewardProgram: ${rewardProgramId}
---------------------------------------------------------------------`);
    let p = groupedByRewardProgram[rewardProgramId];
    p.map((o) => {
      console.log(`  ${o.tokenSymbol}: ${fromWei(o.balance)}`);
    });
  });
}

function displayProofs(proofs: WithSymbol<Proof>[]): void {
  const groupedByRewardProgram = groupBy(proofs, (a) => a.rewardProgramId);
  Object.keys(groupedByRewardProgram).map((rewardProgramId: string) => {
    console.log(`---------------------------------------------------------------------
  RewardProgram: ${rewardProgramId}
---------------------------------------------------------------------`);
    let p = groupedByRewardProgram[rewardProgramId];
    p.map((o) => {
      console.log(`
      paymentCycle: ${o.paymentCycle}
      proof: ${fromProofArray(o.proofArray)}
      leaf: ${o.leaf}
      balance: ${fromWei(o.amount)} ${o.tokenSymbol}
      token: ${o.tokenAddress} (${o.tokenSymbol})
        `);
    });
  });
}

export async function rewardTokensAvailable(network: string, address: string, mnemonic?: string): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  await rewardPool.rewardTokensAvailable(address);
}

export async function addRewardTokens(
  network: string,
  safe: string,
  rewardProgramId: string,
  tokenAddress: string,
  amount: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  await rewardPool.addRewardTokens(safe, rewardProgramId, tokenAddress, amount, {
    onTxnHash: (txnHash) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Added ${amount} of token ${tokenAddress} to reward program ${rewardProgramId}`);
  console.log('done');
}

export async function rewardPoolBalance(
  network: string,
  rewardProgramId: string,
  tokenAddress: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let balance = await rewardPool.balance(rewardProgramId, tokenAddress);
  console.log(`Balance of reward pool`);
  const enhancedBalance = await addTokenSymbol(rewardPool, [balance]);
  displayRewardTokenBalance(enhancedBalance);
}

export async function getClaimableRewardProofs(
  network: string,
  address: string,
  rewardProgramId?: string,
  tokenAddress?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  const proofs = await rewardPool.getProofs(address, rewardProgramId, tokenAddress, false);
  const enhancedProofs = await addTokenSymbol(rewardPool, proofs);

  console.log(`Reward Proofs for ${address}`);
  displayProofs(enhancedProofs);
}

export async function claimRewards(
  network: string,
  rewardSafeAddress: string,
  leaf: string,
  proof: string,
  acceptPartialClaim?: string,
  mnemonic?: string
): Promise<void> {
  let web3 = await getWeb3(network, mnemonic);
  let rewardPool = await getSDK('RewardPool', web3);
  let blockExplorer = await getConstant('blockExplorer', web3);
  let proofArray = fromProof(proof);
  await rewardPool.claim(rewardSafeAddress, leaf, proofArray, acceptPartialClaim, {
    onTxnHash: (txnHash: string) => console.log(`Transaction hash: ${blockExplorer}/tx/${txnHash}/token-transfers`),
  });
  console.log(`Claimed reward to reward safe ${rewardSafeAddress}`);
  console.log('done');
}

async function addTokenSymbol<T extends Proof | RewardTokenBalance>(
  rewardPool: any,
  arrWithTokenAddress: T[]
): Promise<WithSymbol<T>[]> {
  const tokenAddresses = [...new Set(arrWithTokenAddress.map((item) => item.tokenAddress))];
  const tokenMapping = await rewardPool.tokenSymbolMapping(tokenAddresses);
  return arrWithTokenAddress.map((o) => {
    return {
      ...o,
      tokenSymbol: tokenMapping[o.tokenAddress],
    };
  });
}

const fromProofArray = (arr: string[]): string => {
  return (
    '0x' +
    arr.reduce((proof, s) => {
      return proof.concat(s.replace('0x', ''));
    }, '')
  );
};

const fromProof = (proof: string): any => {
  let bytesSize = 32;
  let hexChunkSize = bytesSize * 2;
  let hexStr = proof.replace('0x', '');
  if (hexStr.length % hexChunkSize != 0) {
    throw new Error('proof array is wrong size');
  }
  return chunkString(hexStr, hexChunkSize).map((s) => '0x' + s);
};

function chunkString(str: string, chunkSize: number) {
  let arr = str.match(new RegExp('.{1,' + chunkSize + '}', 'g'));
  if (arr) {
    return arr;
  } else {
    throw new Error('proof cannot be converted to proof array  split properly');
  }
}

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Contract, ContractOptions } from 'web3-eth-contract';
import RevenuePoolABI from '../../contracts/abi/v0.5.5/revenue-pool';
import ERC20ABI from '../../contracts/abi/erc-20';
import { getAddress } from '../../contracts/addresses';
import {
  EventABI,
  getParamsFromEvent,
  SendPayload,
  getSendPayload,
  executeSend,
  GnosisExecTx,
} from '../utils/safe-utils';
import { waitUntilTransactionMined } from '../utils/general-utils';
import { sign, Signature } from '../utils/signing-utils';
import { getSDK } from '../version-resolver';

const { toBN, fromWei } = Web3.utils;

interface RevenueTokenBalance {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string; // balance is in wei
}

export default class RevenuePool {
  private revenuePool: Contract | undefined;

  constructor(private layer2Web3: Web3) {}

  async merchantRegistrationFee(): Promise<number> {
    // this is a SPEND amount which is a safe number to represent in javascript
    return Number(await (await this.getRevenuePool()).methods.merchantRegistrationFeeInSPEND().call());
  }

  async currentTokenUSDRate(tokenAddress: string): Promise<string> {
    let revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    let { price } = await revenuePool.methods.exchangeRateOf(tokenAddress).call();
    return price;
  }

  async balances(merchantSafeAddress: string): Promise<RevenueTokenBalance[]> {
    let revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    let tokenAddresses = (await revenuePool.methods.revenueTokens(merchantSafeAddress).call()) as string[];
    let result = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const tokenContract = new this.layer2Web3.eth.Contract(ERC20ABI as AbiItem[], tokenAddress);
        let [tokenSymbol, balance] = await Promise.all([
          tokenContract.methods.symbol().call() as Promise<string>,
          revenuePool.methods.revenueBalance(merchantSafeAddress, tokenAddress).call() as Promise<string>,
        ]);
        return {
          tokenAddress,
          tokenSymbol,
          balance,
        };
      })
    );
    return result;
  }

  async registerMerchant(
    prepaidCardAddress: string,
    infoDID?: string,
    options?: ContractOptions
  ): Promise<{ merchantSafe: string; gnosisTxn: GnosisExecTx } | undefined> {
    let from = options?.from ?? (await this.layer2Web3.eth.getAccounts())[0];
    let prepaidCard = await getSDK('PrepaidCard', this.layer2Web3);
    let issuingToken = await prepaidCard.issuingToken(prepaidCardAddress);
    let registrationFee = await this.merchantRegistrationFee();
    infoDID = infoDID ?? '';
    await prepaidCard.convertFromSpendForPrepaidCard(
      prepaidCardAddress,
      registrationFee,
      (issuingToken, balanceAmount, requiredTokenAmount) =>
        new Error(
          `Prepaid card does not have enough balance to register a merchant. The issuing token ${issuingToken} balance of prepaid card ${prepaidCardAddress} is ${fromWei(
            balanceAmount.toString()
          )}, payment amount in issuing token is ${fromWei(requiredTokenAmount)}`
        )
    );

    let rateChanged = false;
    do {
      let rateLock = await this.currentTokenUSDRate(issuingToken);
      try {
        let payload = await this.getRegisterMerchantPayload(prepaidCardAddress, registrationFee, rateLock, infoDID);
        if (payload.lastUsedNonce == null) {
          payload.lastUsedNonce = -1;
        }
        let signature = await sign(
          this.layer2Web3,
          issuingToken,
          0,
          payload.data,
          0,
          payload.safeTxGas,
          payload.dataGas,
          payload.gasPrice,
          payload.gasToken,
          payload.refundReceiver,
          toBN(payload.lastUsedNonce + 1),
          from,
          prepaidCardAddress
        );
        let gnosisTxn = await this.executeRegisterMerchant(
          prepaidCardAddress,
          registrationFee,
          rateLock,
          infoDID,
          signature,
          toBN(payload.lastUsedNonce + 1).toString()
        );
        let merchantSafe = await this.getMerchantSafeFromTxn(gnosisTxn.ethereumTx.txHash);
        return { merchantSafe, gnosisTxn };
      } catch (e) {
        // The rate updates about once an hour, so if this is triggered, it should only be once
        if (e.message.includes('rate is beyond the allowable bounds')) {
          rateChanged = true;
        } else {
          throw e;
        }
      }
    } while (rateChanged);
    return;
  }

  private async getRevenuePool(): Promise<Contract> {
    if (this.revenuePool) {
      return this.revenuePool;
    }
    this.revenuePool = new this.layer2Web3.eth.Contract(
      RevenuePoolABI as AbiItem[],
      await getAddress('revenuePool', this.layer2Web3)
    );
    return this.revenuePool;
  }

  private async getMerchantSafeFromTxn(txnHash: string): Promise<string> {
    let revenuePoolAddress = await getAddress('revenuePool', this.layer2Web3);
    let txnReceipt = await waitUntilTransactionMined(this.layer2Web3, txnHash);
    return getParamsFromEvent(this.layer2Web3, txnReceipt, this.createMerchantEventABI(), revenuePoolAddress)[0]
      ?.merchantSafe;
  }

  private async getRegisterMerchantPayload(
    prepaidCardAddress: string,
    spendAmount: number,
    rate: string,
    infoDID: string
  ): Promise<SendPayload> {
    return getSendPayload(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      'registerMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['string'], [infoDID])
    );
  }

  private async executeRegisterMerchant(
    prepaidCardAddress: string,
    spendAmount: number,
    rate: string,
    infoDID: string,
    signatures: Signature[],
    nonce: string
  ): Promise<GnosisExecTx> {
    return await executeSend(
      this.layer2Web3,
      prepaidCardAddress,
      spendAmount,
      rate,
      'registerMerchant',
      this.layer2Web3.eth.abi.encodeParameters(['string'], [infoDID]),
      signatures,
      nonce
    );
  }

  private createMerchantEventABI(): EventABI {
    return {
      topic: this.layer2Web3.eth.abi.encodeEventSignature('MerchantCreation(address,address,string)'),
      abis: [
        {
          type: 'address',
          name: 'merchant',
        },
        {
          type: 'address',
          name: 'merchantSafe',
        },
        {
          type: 'string',
          name: 'infoDID',
        },
      ],
    };
  }
}

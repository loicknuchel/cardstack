import { expect } from 'chai';
import cryptoRandomString from 'crypto-random-string';
import { subDays } from 'date-fns';
import shortUuid from 'short-uuid';
import ScheduledPaymentOnChainCancelationWaiter from '../../tasks/scheduled-payment-on-chain-cancelation-waiter';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';

let sdkError: Error | null = null;
class StubCardpaySDK {
  getSDK(sdk: string) {
    switch (sdk) {
      case 'ScheduledPaymentModule':
        return Promise.resolve({
          cancelPaymentOnChain: async (
            _safeAddress: any,
            _moduleAddress: any,
            _tokenAddress: any,
            _spHash: any,
            _signature: any,
            _obj: any
          ) => {
            if (sdkError) {
              throw sdkError;
            }
            return {
              blockNumber: 123,
            };
          },
        });
      default:
        throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
    }
  }
}

describe('ScheduledPaymentOnChainCancelationWaiterTask', function () {
  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getPrisma, getContainer } = setupHub(this);

  it('returns an error if there is no cancelation tx hash', async function () {
    let prisma = await getPrisma();
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        cancelationTransactionHash: null,
      },
    });
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCancelationWaiter);
    let result = await task.perform({ scheduledPaymentId: scheduledPayment.id });

    expect(result).to.deep.equal({
      status: 'failure',
      message: 'Missing transaction hash',
    });
  });

  it('returns an error if scheduled payment has been canceled more than a day ago and the cancelation transaction still has not been mined', async function () {
    let prisma = await getPrisma();
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: null,
        canceledAt: subDays(nowUtc(), 2),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        cancelationTransactionHash: '0x123',
      },
    });
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCancelationWaiter);
    let result = await task.perform({ scheduledPaymentId: scheduledPayment.id });

    expect(result).to.deep.equal({
      status: 'failure',
      message:
        'Scheduled payment has been canceled more than a day ago and the cancelation transaction still has not been mined',
    });
  });

  it('waits for the transaction to be mined and updates block number', async function () {
    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCancelationWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        cancelationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    await task.perform({ scheduledPaymentId: scheduledPayment.id });
    scheduledPayment = await prisma.scheduledPayment.findUniqueOrThrow({
      where: {
        id: scheduledPayment.id,
      },
    });

    // cancelationBlockNumber is BigInt
    expect(Number(scheduledPayment.cancelationBlockNumber)).to.eq(123);
    expect(scheduledPayment.cancelationTransactionError).to.be.null;
  });

  it('updates the error if revert error happens', async function () {
    sdkError = new Error('Transaction with hash 0x123 was reverted');

    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCancelationWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        cancelationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    await task.perform({ scheduledPaymentId: scheduledPayment.id });
    scheduledPayment = await prisma.scheduledPayment.findUniqueOrThrow({
      where: {
        id: scheduledPayment.id,
      },
    });

    expect(scheduledPayment.cancelationTransactionError).to.eq('Transaction with hash 0x123 was reverted');
  });

  it('restarts the worker if there was an error that we do not handle', async function () {
    sdkError = new Error('unknown error');

    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCancelationWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        cancelationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    expect(task.perform({ scheduledPaymentId: scheduledPayment.id })).to.be.rejected;
  });
});

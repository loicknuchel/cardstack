import { expect } from 'chai';
import ScheduledPaymentOnChainCreationWaiter from '../../tasks/scheduled-payment-on-chain-creation-waiter';
import { registry, setupHub } from '../helpers/server';

class StubCardpaySDK {
  getSDK(sdk: string) {
    switch (sdk) {
      case 'ScheduledPaymentModule':
        return Promise.resolve({
          schedulePayment: async (
            _safeAddress: any,
            _moduleAddress: any,
            _tokenAddress: any,
            _spHash: any,
            _signature: any,
            _obj: any
          ) => {
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

describe('ScheduledPaymentOnChainCreationWaiterTask', function () {
  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getPrisma, getContainer } = setupHub(this);

  it('waits for the transaction to be mined and updates block number', async function () {
    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainCreationWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        amount: 100,
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: 1000000000,
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: '0x123',
        chainId: 1,
        signature: '0x123',
        creationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    await task.perform({ scheduledPaymentId: scheduledPayment.id });
    scheduledPayment = await prisma.scheduledPayment.findUniqueOrThrow({
      where: {
        id: scheduledPayment.id,
      },
    });

    // creationBlockNumber is BigInt
    expect(Number(scheduledPayment.creationBlockNumber)).to.eq(123);
  });
});

const status = {
  nickname: {
    code: {
      AVAILABLE: '0',
      CLAIMED: '1',
      PENDING_CLAIM: '2', // Awaiting for block to be mined
      PENDING_TRANSFER: '3', // Awaiting for block to be mined
      PENDING_RELEASE: '4', // Awaiting for block to be mined
    }
  },
  action: {
    code: {
      MEMPOOL: '0', // Actions still in mempool - Not to be processed
      UNPROCESSED: '1', // Actions ready to be processed
      ACCEPTED: '2',
      REJECTED_CLAIM_EXISTING: '10',
      REJECTED_CLAIM_FEE_LOST: '11',
      REJECTED_CLAIM_ADDRESS_UNAVAILABLE: '12',
      REJECTED_CLAIM_INDEX_LOST: '13',
      REJECTED_TRANSFER_NO_OWNERSHIP: '20',
      REJECTED_TRANSFER_FEE_LOST: '21',
      REJECTED_TRANSFER_INDEX_LOST: '13',
      REJECTED_TRANSFER_RECIPIENT_UNAVAILABLE: '13',
      REJECTED_RELEASE_NO_OWNERSHIP: '30',
      REJECTED_RELEASE_FEE_LOST: '31',
      REJECTED_RELEASE_INDEX_LOST: '13',
      REJECTED_INVALID_FORMAT: '41',
      REJECTED_INVALID_NICKNAME: '42'
    }
  },
  block: {
    code: {
      UNPROCESSED: '0',
      PROCESSED: '1',
    }
  },
};

module.exports = status;

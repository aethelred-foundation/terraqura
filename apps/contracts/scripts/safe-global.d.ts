declare module "@safe-global/safe-core-sdk-types" {
  export type SafeOperationType = number;

  export const OperationType: {
    Call: SafeOperationType;
    DelegateCall: SafeOperationType;
  };

  export interface MetaTransactionData {
    to: string;
    value: string;
    data: string;
    operation: SafeOperationType;
  }
}

declare module "@safe-global/api-kit" {
  export interface SafeApiKitOptions {
    chainId: bigint;
    txServiceUrl?: string;
  }

  export interface ProposeTransactionArgs {
    safeAddress: string;
    safeTransactionData: unknown;
    safeTxHash: string;
    senderAddress: string;
    senderSignature: string;
  }

  export default class SafeApiKit {
    constructor(options: SafeApiKitOptions);
    proposeTransaction(args: ProposeTransactionArgs): Promise<void>;
    getTransaction(safeTxHash: string): Promise<unknown>;
  }
}

declare module "@safe-global/protocol-kit" {
  import type { MetaTransactionData } from "@safe-global/safe-core-sdk-types";

  export interface SafeAccountConfig {
    owners: string[];
    threshold: number;
  }

  export class SafeFactory {
    static create(args: { ethAdapter: unknown }): Promise<SafeFactory>;
    deploySafe(args: {
      safeAccountConfig: SafeAccountConfig;
      options?: { gasLimit?: number };
    }): Promise<Safe>;
  }

  export default class Safe {
    static create(args: {
      ethAdapter: unknown;
      safeAddress: string;
    }): Promise<Safe>;
    createTransaction(args: {
      transactions: MetaTransactionData[];
    }): Promise<{ data: unknown }>;
    signTransaction(
      safeTransaction: unknown
    ): Promise<{ signatures: Map<string, { data: string }> }>;
    getTransactionHash(safeTransaction: unknown): Promise<string>;
    executeTransaction(
      safeTransaction: unknown
    ): Promise<{ transactionResponse?: { wait(): Promise<{ hash: string }> } }>;
    getAddress(): Promise<string>;
  }
}
